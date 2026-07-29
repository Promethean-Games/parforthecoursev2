package com.parforthecourse.app

import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    companion object {
        private const val TAG = "PFTCWebView"
        private const val WEBVIEW_STATE_KEY = "webview_state"
        private const val SHOWING_FALLBACK_KEY = "showing_fallback"
    }

    private lateinit var webView: WebView
    private var showingFallback = false
    private var retriedInitialLoad = false
    private val secureOverlayKeys = mutableSetOf<String>()

    private inner class ScreenSecurityBridge {
        @JavascriptInterface
        fun setCardVisibility(key: String?, visible: Boolean) {
            if (key.isNullOrBlank()) return
            runOnUiThread {
                if (visible) {
                    secureOverlayKeys.add(key)
                } else {
                    secureOverlayKeys.remove(key)
                }
                applySecureFlag()
            }
        }

        // Backward-compatible fallback used by older web bundles.
        @JavascriptInterface
        fun setCardsVisible(visible: Boolean) {
            setCardVisibility("cards", visible)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true
            addJavascriptInterface(ScreenSecurityBridge(), "AndroidScreenSecurity")

            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    Log.i(TAG, "onPageStarted url=$url")
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    return false
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true) {
                        val detail = "errorCode=${error?.errorCode}, description=${error?.description}, url=${request.url}"
                        Log.e(TAG, "Main frame load error: $detail")
                        handleMainFrameLoadFailure(getString(R.string.web_unavailable_message), detail)
                    }
                }

                override fun onReceivedHttpError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    errorResponse: WebResourceResponse?
                ) {
                    super.onReceivedHttpError(view, request, errorResponse)
                    if (request?.isForMainFrame == true && (errorResponse?.statusCode ?: 200) >= 400) {
                        val detail = "status=${errorResponse?.statusCode}, reason=${errorResponse?.reasonPhrase}, url=${request.url}"
                        Log.e(TAG, "Main frame HTTP error: $detail")
                        handleMainFrameLoadFailure(getString(R.string.web_unavailable_message), detail)
                    }
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (showingFallback) return

                    val loadingAppUrl = url?.startsWith(BuildConfig.APP_URL) == true
                    if (!loadingAppUrl) return

                    // Some hosts return an outage/suspension page with HTTP 200.
                    view?.evaluateJavascript(
                        "document.body ? document.body.innerText.toLowerCase() : ''"
                    ) { bodyText ->
                        if (bodyText.contains("service has been suspended by its owner")) {
                            Log.e(TAG, "Host suspension marker found on page body for url=$url")
                            showFallbackPage(
                                getString(R.string.web_suspended_message),
                                "Service suspension marker detected on hosted page body"
                            )
                        }
                    }
                }
            }
            webChromeClient = WebChromeClient()
        }

        setContentView(webView)

        val restoringFallback = savedInstanceState?.getBoolean(SHOWING_FALLBACK_KEY) == true
        val restored = if (!restoringFallback) {
            savedInstanceState?.getBundle(WEBVIEW_STATE_KEY)?.let { state ->
                webView.restoreState(state)
            }
        } else {
            null
        }
        if (restored == null) {
            Log.i(TAG, "No restorable WebView state; loading app URL")
            loadAppUrl()
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)

        outState.putBoolean(SHOWING_FALLBACK_KEY, showingFallback)
        if (showingFallback) return

        val webViewState = Bundle()
        webView.saveState(webViewState)
        outState.putBundle(WEBVIEW_STATE_KEY, webViewState)
    }

    override fun onDestroy() {
        if (isFinishing) {
            secureOverlayKeys.clear()
            applySecureFlag()
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun loadAppUrl() {
        showingFallback = false
        retriedInitialLoad = false
        secureOverlayKeys.clear()
        applySecureFlag()
        webView.stopLoading()
        webView.clearHistory()
        Log.i(TAG, "Loading APP_URL=${BuildConfig.APP_URL}")
        webView.loadUrl(BuildConfig.APP_URL)
    }

    private fun handleMainFrameLoadFailure(message: String, detail: String? = null) {
        if (!retriedInitialLoad) {
            retriedInitialLoad = true
            Log.w(TAG, "Main frame failed. Retrying once in 600ms. detail=$detail")
            webView.postDelayed({
                if (!showingFallback) {
                    Log.i(TAG, "Retrying APP_URL load")
                    webView.loadUrl(BuildConfig.APP_URL)
                }
            }, 600)
            return
        }
        Log.e(TAG, "Main frame failed after retry. Showing fallback. detail=$detail")
        showFallbackPage(message, detail)
    }

    private fun applySecureFlag() {
        if (secureOverlayKeys.isNotEmpty()) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    private fun showFallbackPage(message: String, detail: String? = null) {
        if (showingFallback) return
        showingFallback = true

        val debugDetailHtml = if (BuildConfig.DEBUG && !detail.isNullOrBlank()) {
            "<p style=\"color:#fbbf24;font-size:12px;word-break:break-word\">$detail</p>"
        } else {
            ""
        }

        val html = """
            <!doctype html>
            <html>
            <head>
              <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
              <style>
                body { font-family: sans-serif; background:#0f0f0f; color:#f5f5f5; margin:0; padding:24px; }
                .card { max-width:480px; margin:20vh auto 0; padding:20px; background:#1a1a1a; border-radius:12px; }
                h1 { margin-top:0; font-size:22px; }
                p { color:#d4d4d4; line-height:1.45; }
                button { margin-top:16px; background:#22c55e; border:none; color:#08130b; padding:10px 14px; border-radius:8px; font-weight:600; }
              </style>
            </head>
            <body>
              <div class=\"card\">
                <h1>${getString(R.string.app_name)}</h1>
                <p>$message</p>
                $debugDetailHtml
                <button onclick=\"location.href='${BuildConfig.APP_URL}'\">${getString(R.string.retry_button)}</button>
              </div>
            </body>
            </html>
        """.trimIndent()

        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
    }
}

