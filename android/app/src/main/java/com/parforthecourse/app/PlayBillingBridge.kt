package com.parforthecourse.app

import android.app.Activity
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesResponseListener
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Narrow billing bridge exposed to WebView JavaScript.
 *
 * Allowed operations only:
 * - queryCatalog: read-only product metadata (title/price)
 * - launchPurchase: start Google Play purchase UI for one inapp product
 * - syncPurchases: query existing purchases + pending states
 *
 * Entitlements are never granted directly from JavaScript. JS only receives
 * billing events and must reconcile ownership from returned purchase states.
 */
class PlayBillingBridge(
    private val activity: Activity,
    private val webView: WebView
) : PurchasesUpdatedListener {

    companion object {
        private const val TAG = "PFTCPlayBilling"
        private const val EVENT_NAME = "pftc-play-billing"
    }

    private val billingClient: BillingClient = BillingClient.newBuilder(activity)
        .setListener(this)
        .enablePendingPurchases()
        .build()

    @Volatile
    private var isConnected: Boolean = false

    @Volatile
    private var activePurchaseRequestId: String? = null

    init {
        ensureConnection()
    }

    fun destroy() {
        if (billingClient.isReady) {
            billingClient.endConnection()
        }
        isConnected = false
    }

    @JavascriptInterface
    fun queryCatalog(requestJson: String) {
        val request = parseRequest(requestJson)
        val requestId = request.optString("requestId").ifBlank { newRequestId() }
        val productIdsArray = request.optJSONArray("productIds") ?: JSONArray()
        val productIds = mutableListOf<String>()
        for (index in 0 until productIdsArray.length()) {
            val productId = productIdsArray.optString(index).trim()
            if (productId.isNotEmpty()) {
                productIds.add(productId)
            }
        }

        if (productIds.isEmpty()) {
            emitError("catalog_result", requestId, "No product IDs were provided.")
            return
        }

        withConnectedClient(
            requestId = requestId,
            operation = "catalog_result"
        ) {
            val queryProducts = productIds.map { productId ->
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            }

            val params = QueryProductDetailsParams.newBuilder()
                .setProductList(queryProducts)
                .build()

            billingClient.queryProductDetailsAsync(params) { result, detailsList ->
                if (result.responseCode != BillingResponseCode.OK) {
                    emitError(
                        type = "catalog_result",
                        requestId = requestId,
                        message = "Failed to query product details (${result.responseCode}): ${result.debugMessage}",
                        code = result.responseCode
                    )
                    return@queryProductDetailsAsync
                }

                val detailsById = detailsList.associateBy { it.productId }
                val products = JSONArray()
                productIds.forEach { productId ->
                    val detail = detailsById[productId]
                    products.put(detailToJson(productId, detail))
                }

                emitEvent(
                    type = "catalog_result",
                    requestId = requestId,
                    payload = JSONObject()
                        .put("ok", true)
                        .put("products", products)
                        .put("billingReady", isConnected)
                )
            }
        }
    }

    @JavascriptInterface
    fun launchPurchase(requestJson: String) {
        val request = parseRequest(requestJson)
        val requestId = request.optString("requestId").ifBlank { newRequestId() }
        val productId = request.optString("productId").trim()

        if (productId.isEmpty()) {
            emitError("purchase_result", requestId, "No product ID was provided.")
            return
        }

        activePurchaseRequestId = requestId

        withConnectedClient(
            requestId = requestId,
            operation = "purchase_result"
        ) {
            val params = QueryProductDetailsParams.newBuilder()
                .setProductList(
                    listOf(
                        QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(productId)
                            .setProductType(BillingClient.ProductType.INAPP)
                            .build()
                    )
                )
                .build()

            billingClient.queryProductDetailsAsync(params) { result, detailsList ->
                if (result.responseCode != BillingResponseCode.OK) {
                    emitError(
                        type = "purchase_result",
                        requestId = requestId,
                        message = "Could not load product details (${result.responseCode}): ${result.debugMessage}",
                        code = result.responseCode
                    )
                    activePurchaseRequestId = null
                    return@queryProductDetailsAsync
                }

                val productDetail = detailsList.firstOrNull()
                if (productDetail == null) {
                    emitError(
                        type = "purchase_result",
                        requestId = requestId,
                        message = "Product is unavailable or not configured in Google Play."
                    )
                    activePurchaseRequestId = null
                    return@queryProductDetailsAsync
                }

                activity.runOnUiThread {
                    val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetail)
                        .build()

                    val billingParams = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(listOf(productDetailsParams))
                        .build()

                    val launchResult = billingClient.launchBillingFlow(activity, billingParams)
                    if (launchResult.responseCode != BillingResponseCode.OK) {
                        emitError(
                            type = "purchase_result",
                            requestId = requestId,
                            message = "Could not start purchase flow (${launchResult.responseCode}): ${launchResult.debugMessage}",
                            code = launchResult.responseCode
                        )
                        activePurchaseRequestId = null
                    }
                }
            }
        }
    }

    @JavascriptInterface
    fun syncPurchases(requestJson: String) {
        val request = parseRequest(requestJson)
        val requestId = request.optString("requestId").ifBlank { newRequestId() }

        withConnectedClient(
            requestId = requestId,
            operation = "sync_result"
        ) {
            queryOwnedPurchases(requestId)
        }
    }

    override fun onPurchasesUpdated(
        billingResult: com.android.billingclient.api.BillingResult,
        purchases: MutableList<Purchase>?
    ) {
        val requestId = activePurchaseRequestId ?: newRequestId()

        when (billingResult.responseCode) {
            BillingResponseCode.OK -> {
                if (purchases.isNullOrEmpty()) {
                    emitEvent(
                        type = "purchase_result",
                        requestId = requestId,
                        payload = JSONObject()
                            .put("ok", false)
                            .put("status", "failed")
                            .put("message", "Purchase completed with no purchase records.")
                    )
                    activePurchaseRequestId = null
                    return
                }

                val purchasedProductIds = mutableSetOf<String>()
                val pendingProductIds = mutableSetOf<String>()

                purchases.forEach { purchase ->
                    when (purchase.purchaseState) {
                        Purchase.PurchaseState.PURCHASED -> {
                            purchasedProductIds.addAll(purchase.products)
                            maybeAcknowledgePurchase(purchase)
                        }
                        Purchase.PurchaseState.PENDING -> {
                            pendingProductIds.addAll(purchase.products)
                        }
                    }
                }

                val status = when {
                    purchasedProductIds.isNotEmpty() -> "purchased"
                    pendingProductIds.isNotEmpty() -> "pending"
                    else -> "failed"
                }

                emitEvent(
                    type = "purchase_result",
                    requestId = requestId,
                    payload = JSONObject()
                        .put("ok", status != "failed")
                        .put("status", status)
                        .put("purchasedProductIds", JSONArray(purchasedProductIds.toList()))
                        .put("pendingProductIds", JSONArray(pendingProductIds.toList()))
                )
            }

            BillingResponseCode.USER_CANCELED -> {
                emitEvent(
                    type = "purchase_result",
                    requestId = requestId,
                    payload = JSONObject()
                        .put("ok", false)
                        .put("status", "cancelled")
                        .put("message", "Purchase cancelled.")
                )
            }

            else -> {
                emitError(
                    type = "purchase_result",
                    requestId = requestId,
                    message = "Purchase failed (${billingResult.responseCode}): ${billingResult.debugMessage}",
                    code = billingResult.responseCode
                )
            }
        }

        activePurchaseRequestId = null
    }

    private fun queryOwnedPurchases(requestId: String) {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build()

        val listener = PurchasesResponseListener { billingResult, purchases ->
            if (billingResult.responseCode != BillingResponseCode.OK) {
                emitError(
                    type = "sync_result",
                    requestId = requestId,
                    message = "Purchase sync failed (${billingResult.responseCode}): ${billingResult.debugMessage}",
                    code = billingResult.responseCode
                )
                return@PurchasesResponseListener
            }

            val ownedProductIds = mutableSetOf<String>()
            val pendingProductIds = mutableSetOf<String>()

            purchases.forEach { purchase ->
                when (purchase.purchaseState) {
                    Purchase.PurchaseState.PURCHASED -> {
                        ownedProductIds.addAll(purchase.products)
                        maybeAcknowledgePurchase(purchase)
                    }
                    Purchase.PurchaseState.PENDING -> {
                        pendingProductIds.addAll(purchase.products)
                    }
                }
            }

            emitEvent(
                type = "sync_result",
                requestId = requestId,
                payload = JSONObject()
                    .put("ok", true)
                    .put("authoritative", true)
                    .put("ownedProductIds", JSONArray(ownedProductIds.toList()))
                    .put("pendingProductIds", JSONArray(pendingProductIds.toList()))
            )
        }

        billingClient.queryPurchasesAsync(params, listener)
    }

    private fun maybeAcknowledgePurchase(purchase: Purchase) {
        if (purchase.isAcknowledged) return
        val token = purchase.purchaseToken
        if (token.isBlank()) return

        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(token)
            .build()

        billingClient.acknowledgePurchase(params) { result ->
            if (result.responseCode != BillingResponseCode.OK) {
                Log.w(
                    TAG,
                    "Purchase acknowledge failed code=${result.responseCode} msg=${result.debugMessage}"
                )
            }
        }
    }

    private fun ensureConnection() {
        if (billingClient.isReady) {
            isConnected = true
            return
        }

        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: com.android.billingclient.api.BillingResult) {
                isConnected = result.responseCode == BillingResponseCode.OK
                if (!isConnected) {
                    Log.w(
                        TAG,
                        "Billing setup failed code=${result.responseCode} msg=${result.debugMessage}"
                    )
                }
            }

            override fun onBillingServiceDisconnected() {
                isConnected = false
            }
        })
    }

    private fun withConnectedClient(
        requestId: String,
        operation: String,
        action: () -> Unit
    ) {
        if (billingClient.isReady) {
            isConnected = true
            action()
            return
        }

        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: com.android.billingclient.api.BillingResult) {
                isConnected = result.responseCode == BillingResponseCode.OK
                if (!isConnected) {
                    emitError(
                        type = operation,
                        requestId = requestId,
                        message = "Billing service unavailable (${result.responseCode}): ${result.debugMessage}",
                        code = result.responseCode
                    )
                    return
                }
                action()
            }

            override fun onBillingServiceDisconnected() {
                isConnected = false
                emitError(
                    type = operation,
                    requestId = requestId,
                    message = "Billing service disconnected."
                )
            }
        })
    }

    private fun detailToJson(productId: String, detail: ProductDetails?): JSONObject {
        val oneTimeDetails = detail?.oneTimePurchaseOfferDetails
        return JSONObject()
            .put("productId", productId)
            .put("available", detail != null)
            .put("title", detail?.title ?: "")
            .put("description", detail?.description ?: "")
            .put("formattedPrice", oneTimeDetails?.formattedPrice ?: JSONObject.NULL)
            .put("priceCurrencyCode", oneTimeDetails?.priceCurrencyCode ?: JSONObject.NULL)
            .put("priceAmountMicros", oneTimeDetails?.priceAmountMicros ?: JSONObject.NULL)
    }

    private fun emitError(type: String, requestId: String, message: String, code: Int? = null) {
        val payload = JSONObject()
            .put("ok", false)
            .put("message", message)
        if (code != null) {
            payload.put("code", code)
        }

        emitEvent(type = type, requestId = requestId, payload = payload)
    }

    private fun emitEvent(type: String, requestId: String, payload: JSONObject) {
        val envelope = JSONObject()
            .put("type", type)
            .put("requestId", requestId)
            .put("timestamp", System.currentTimeMillis())
            .put("payload", payload)

        val js = "window.dispatchEvent(new CustomEvent('$EVENT_NAME', { detail: ${envelope.toString()} }));"
        activity.runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
    }

    private fun parseRequest(raw: String): JSONObject {
        return try {
            JSONObject(raw)
        } catch (_: Throwable) {
            JSONObject()
        }
    }

    private fun newRequestId(): String = UUID.randomUUID().toString()
}
