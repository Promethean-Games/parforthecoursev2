package com.parforthecourse.app

import android.app.Activity
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.PendingPurchasesParams
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
 * Purchase events carry the purchase token so the client can have the server verify
 * the purchase with Google. Tokens are credentials: never log them. Entitlements are
 * never granted from these events alone; the client grants only after server verification.
 *
 * Acknowledgement is NOT done here. The verification backend acknowledges a purchase
 * only after Google confirms it is PURCHASED, so there is a single acknowledger. Unverified
 * purchases stay unacknowledged and are re-sent on every sync until verified (Google
 * refunds unacknowledged purchases after 3 days).
 */
class PlayBillingBridge(
    private val activity: Activity,
    private val webView: WebView
) : PurchasesUpdatedListener {

    companion object {
        private const val TAG = "PFTCPlayBilling"
        private const val DIAG_TAG = "PftCBillingDiag"
        private const val EVENT_NAME = "pftc-play-billing"

        // Confirmed Google Play product IDs; the only products this bridge will query or purchase.
        private val ALLOWED_PRODUCT_IDS = setOf(
            "google_play_product_classic",
            "google_play_product_reracked",
            "google_play_product_sequential",
            "google_play_product_tournament",
            "google_play_product_teedoff",
            "google_play_product_bundle"
        )
    }

    private val billingClient: BillingClient = BillingClient.newBuilder(activity)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build()
        )
        .build()

    @Volatile
    private var isConnected: Boolean = false

    @Volatile
    private var activePurchaseRequestId: String? = null

    init {
        Log.i(
            DIAG_TAG,
            "app package=${activity.packageName} buildType=${BuildConfig.BUILD_TYPE}"
        )
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
            if (productId.isNotEmpty() && productId in ALLOWED_PRODUCT_IDS) {
                productIds.add(productId)
            }
        }

        if (productIds.isEmpty()) {
            emitError("catalog_result", requestId, "No supported product IDs were provided.")
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

            billingClient.queryProductDetailsAsync(params) { result, queryResult ->
                Log.i(
                    DIAG_TAG,
                    "catalog product query responseCode=${result.responseCode} debugMessage=${result.debugMessage}"
                )
                logProductDetails(queryResult.productDetailsList, productIds)
                if (result.responseCode != BillingResponseCode.OK) {
                    emitError(
                        type = "catalog_result",
                        requestId = requestId,
                        message = "Failed to query product details (${result.responseCode}): ${result.debugMessage}",
                        code = result.responseCode
                    )
                    return@queryProductDetailsAsync
                }

                val detailsList = queryResult.productDetailsList
                val detailsById = linkedMapOf<String, ProductDetails>()
                for (detail in detailsList) {
                    detailsById[detail.productId] = detail
                }
                val products = JSONArray()
                for (productId in productIds) {
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

        if (productId.isEmpty() || productId !in ALLOWED_PRODUCT_IDS) {
            emitError("purchase_result", requestId, "Unsupported product ID.")
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

            billingClient.queryProductDetailsAsync(params) { result, queryResult ->
                Log.i(
                    DIAG_TAG,
                    "purchase product query productId=$productId responseCode=${result.responseCode} debugMessage=${result.debugMessage}"
                )
                logProductDetails(queryResult.productDetailsList, listOf(productId))
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

                val detailsList = queryResult.productDetailsList
                var productDetail: ProductDetails? = null
                for (detail in detailsList) {
                    if (detail.productId == productId) {
                        productDetail = detail
                        break
                    }
                }
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
                    Log.i(
                        DIAG_TAG,
                        "launchBillingFlow productId=$productId responseCode=${launchResult.responseCode} debugMessage=${launchResult.debugMessage}"
                    )
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
        Log.i(
            DIAG_TAG,
            "onPurchasesUpdated responseCode=${billingResult.responseCode} debugMessage=${billingResult.debugMessage}"
        )
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

                val purchaseRecords = purchasesToJson(purchases)
                val purchasedProductIds = productIdsWithState(purchaseRecords, "purchased")
                val pendingProductIds = productIdsWithState(purchaseRecords, "pending")

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
                        .put("purchases", purchaseRecords)
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

            BillingResponseCode.ITEM_ALREADY_OWNED -> {
                // The user already owns the product: return the existing purchases so JS can
                // verify them server-side. Nothing is granted here.
                queryOwnedPurchasesForPurchaseResult(requestId)
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

    private fun queryOwnedPurchasesForPurchaseResult(requestId: String) {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build()

        billingClient.queryPurchasesAsync(params) { billingResult, purchases ->
            if (billingResult.responseCode != BillingResponseCode.OK) {
                emitError(
                    type = "purchase_result",
                    requestId = requestId,
                    message = "Could not restore existing purchase (${billingResult.responseCode}): ${billingResult.debugMessage}",
                    code = billingResult.responseCode
                )
                return@queryPurchasesAsync
            }

            val purchaseRecords = purchasesToJson(purchases)
            val purchasedProductIds = productIdsWithState(purchaseRecords, "purchased")
            val pendingProductIds = productIdsWithState(purchaseRecords, "pending")
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
                    .put("message", if (status == "failed") "Item already owned but no purchase could be restored." else "")
                    .put("purchasedProductIds", JSONArray(purchasedProductIds.toList()))
                    .put("pendingProductIds", JSONArray(pendingProductIds.toList()))
                    .put("purchases", purchaseRecords)
            )
        }
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

            val purchaseRecords = purchasesToJson(purchases)

            emitEvent(
                type = "sync_result",
                requestId = requestId,
                payload = JSONObject()
                    .put("ok", true)
                    .put("authoritative", true)
                    .put("ownedProductIds", JSONArray(productIdsWithState(purchaseRecords, "purchased").toList()))
                    .put("pendingProductIds", JSONArray(productIdsWithState(purchaseRecords, "pending").toList()))
                    .put("purchases", purchaseRecords)
            )
        }

        billingClient.queryPurchasesAsync(params, listener)
    }

    // One record per allowed product in a PURCHASED or PENDING purchase. Contains the purchase token.
    private fun purchasesToJson(purchases: List<Purchase>): JSONArray {
        val records = JSONArray()
        for (purchase in purchases) {
            val state = when (purchase.purchaseState) {
                Purchase.PurchaseState.PURCHASED -> "purchased"
                Purchase.PurchaseState.PENDING -> "pending"
                else -> null
            }
            if (state == null || purchase.purchaseToken.isBlank()) continue
            for (productId in purchase.products) {
                if (productId !in ALLOWED_PRODUCT_IDS) continue
                records.put(
                    JSONObject()
                        .put("productId", productId)
                        .put("purchaseToken", purchase.purchaseToken)
                        .put("state", state)
                        .put("acknowledged", purchase.isAcknowledged)
                )
            }
        }
        return records
    }

    private fun productIdsWithState(records: JSONArray, state: String): Set<String> {
        val ids = linkedSetOf<String>()
        for (index in 0 until records.length()) {
            val record = records.getJSONObject(index)
            if (record.getString("state") == state) ids.add(record.getString("productId"))
        }
        return ids
    }

    private fun ensureConnection() {
        if (billingClient.isReady) {
            isConnected = true
            return
        }

        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: com.android.billingclient.api.BillingResult) {
                isConnected = result.responseCode == BillingResponseCode.OK
                Log.i(
                    DIAG_TAG,
                    "billing connection responseCode=${result.responseCode} debugMessage=${result.debugMessage}"
                )
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
                Log.i(
                    DIAG_TAG,
                    "billing connection responseCode=${result.responseCode} debugMessage=${result.debugMessage}"
                )
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

    private fun logProductDetails(details: List<ProductDetails>, requestedProductIds: List<String>) {
        val classicReturned = details.any { it.productId == "google_play_product_classic" }
        Log.i(
            DIAG_TAG,
            "product details requested=$requestedProductIds classicProductReturned=$classicReturned"
        )
        details.forEach { detail ->
            Log.i(
                DIAG_TAG,
                "ProductDetails productId=${detail.productId} productType=${detail.productType}"
            )
        }
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
