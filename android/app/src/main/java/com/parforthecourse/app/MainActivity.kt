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
        private const val WEBVIEW_STATE_KEY    = "webview_state"
        private const val SHOWING_FALLBACK_KEY = "showing_fallback"

        /** True when the diagnostic panel should be shown on failure. */
        private val DIAG_ENABLED get() = BuildConfig.DEBUG || BuildConfig.DIAGNOSTIC_MODE
    }

    private lateinit var webView: WebView
    private var showingFallback    = false
    private var retriedInitialLoad = false
    private val secureOverlayKeys  = mutableSetOf<String>()

    // ── ScreenSecurity JS bridge ──────────────────────────────────────────────
    private inner class ScreenSecurityBridge {
        @JavascriptInterface
        fun setCardVisibility(key: String?, visible: Boolean) {
            if (key.isNullOrBlank()) return
            runOnUiThread {
                if (visible) secureOverlayKeys.add(key) else secureOverlayKeys.remove(key)
                applySecureFlag()
            }
        }

        @JavascriptInterface
        fun setCardsVisible(visible: Boolean) = setCardVisibility("cards", visible)
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialise diagnostics as the very first thing.
        StartupDiagnostics.init(
            appVersion = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
            apiBaseUrl = BuildConfig.APP_URL
        )
        StartupDiagnostics.stepStarted("Activity onCreate")
        StartupDiagnostics.updateNetworkStatus(this)

        webView = WebView(this).apply {
            StartupDiagnostics.stepStarted("WebView setup")
            settings.javaScriptEnabled  = true
            settings.domStorageEnabled  = true
            settings.loadWithOverviewMode = true
            settings.useWideViewPort    = true
            addJavascriptInterface(ScreenSecurityBridge(), "AndroidScreenSecurity")

            webViewClient = object : WebViewClient() {

                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    Log.i(TAG, "onPageStarted url=$url")
                    StartupDiagnostics.stepStarted("Page loading: $url")
                    // Refresh network status every time a load begins.
                    StartupDiagnostics.updateNetworkStatus(this@MainActivity)
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean = false

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true) {
                        val detail = "errorCode=${error?.errorCode}, description=${error?.description}, url=${request.url}"
                        Log.e(TAG, "Main frame load error: $detail")

                        StartupDiagnostics.stepFailed(
                            step             = "Main frame load",
                            exceptionMessage = "WebResourceError ${error?.errorCode}: ${error?.description}"
                        )

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
                        val statusCode = errorResponse?.statusCode
                        val detail     = "status=$statusCode, reason=${errorResponse?.reasonPhrase}, url=${request.url}"
                        Log.e(TAG, "Main frame HTTP error: $detail")

                        // Try to read the response body (stream may already be consumed).
                        val body = try {
                            errorResponse?.data?.bufferedReader()?.use { it.readText() }
                        } catch (_: Exception) { null }

                        StartupDiagnostics.stepFailed(
                            step             = "HTTP response for ${request.url}",
                            exceptionMessage = "HTTP $statusCode ${errorResponse?.reasonPhrase}",
                            httpStatusCode   = statusCode,
                            responseBody     = body
                        )

                        handleMainFrameLoadFailure(getString(R.string.web_unavailable_message), detail)
                    }
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    if (showingFallback) return

                    val loadingAppUrl = url?.startsWith(BuildConfig.APP_URL) == true
                    if (!loadingAppUrl) return

                    StartupDiagnostics.stepSucceeded("Page loaded: $url")

                    // Some hosts return an outage/suspension page with HTTP 200.
                    view?.evaluateJavascript(
                        "document.body ? document.body.innerText.toLowerCase() : ''"
                    ) { bodyText ->
                        if (bodyText.contains("service has been suspended by its owner")) {
                            Log.e(TAG, "Host suspension marker found on page body for url=$url")
                            StartupDiagnostics.stepFailed(
                                step             = "Page content check",
                                exceptionMessage = "Service suspension marker detected in page body",
                                responseBody     = bodyText.take(500)
                            )
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
        StartupDiagnostics.stepSucceeded("WebView setup")

        val restoringFallback = savedInstanceState?.getBoolean(SHOWING_FALLBACK_KEY) == true
        val restored = if (!restoringFallback) {
            savedInstanceState?.getBundle(WEBVIEW_STATE_KEY)?.let { state ->
                webView.restoreState(state)
            }
        } else null

        if (restored == null) {
            Log.i(TAG, "No restorable WebView state; loading app URL")
            loadAppUrl()
        } else {
            StartupDiagnostics.stepSucceeded("WebView state restored")
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

    // ── Private helpers ───────────────────────────────────────────────────────
    private fun loadAppUrl() {
        showingFallback    = false
        retriedInitialLoad = false
        secureOverlayKeys.clear()
        applySecureFlag()
        webView.stopLoading()
        webView.clearHistory()
        Log.i(TAG, "Loading APP_URL=${BuildConfig.APP_URL}")
        StartupDiagnostics.stepStarted("Loading APP_URL: ${BuildConfig.APP_URL}")
        webView.loadUrl(BuildConfig.APP_URL)
    }

    private fun handleMainFrameLoadFailure(message: String, detail: String? = null) {
        if (!retriedInitialLoad) {
            retriedInitialLoad = true
            Log.w(TAG, "Main frame failed. Retrying once in 600 ms. detail=$detail")
            StartupDiagnostics.stepStarted("Retry load (600 ms delay)")
            StartupDiagnostics.updateNetworkStatus(this)
            webView.postDelayed({
                if (!showingFallback) {
                    Log.i(TAG, "Retrying APP_URL load")
                    StartupDiagnostics.stepStarted("Retry: Loading APP_URL")
                    webView.loadUrl(BuildConfig.APP_URL)
                }
            }, 600)
            return
        }
        Log.e(TAG, "Main frame failed after retry. Showing fallback. detail=$detail")
        StartupDiagnostics.updateNetworkStatus(this)
        StartupDiagnostics.dumpToLogcat()
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

        val html = if (DIAG_ENABLED) {
            buildDiagnosticHtml(message)
        } else {
            buildSimpleHtml(message)
        }

        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
    }

    // ── HTML builders ─────────────────────────────────────────────────────────

    /** Production fallback — plain error card, no sensitive info. */
    private fun buildSimpleHtml(message: String): String = """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: sans-serif; background:#0f0f0f; color:#f5f5f5; margin:0; padding:24px; }
            .card { max-width:480px; margin:20vh auto 0; padding:20px; background:#1a1a1a; border-radius:12px; }
            h1 { margin-top:0; font-size:22px; }
            p  { color:#d4d4d4; line-height:1.45; }
            button { margin-top:16px; background:#22c55e; border:none; color:#08130b;
                     padding:10px 14px; border-radius:8px; font-weight:600; cursor:pointer; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${esc(getString(R.string.app_name))}</h1>
            <p>${esc(message)}</p>
            <button onclick="location.href='${esc(BuildConfig.APP_URL)}'">${esc(getString(R.string.retry_button))}</button>
          </div>
        </body>
        </html>
    """.trimIndent()

    /** Debug / diagnostic fallback — full panel with all available info. */
    private fun buildDiagnosticHtml(message: String): String {
        val s = StartupDiagnostics.state

        fun row(label: String, value: String?, highlight: Boolean = false): String {
            if (value.isNullOrBlank()) return ""
            val color = if (highlight) "#f87171" else "#a3e635"
            return """<tr>
                <td class="lbl">${esc(label)}</td>
                <td style="color:$color">${esc(value)}</td>
              </tr>"""
        }

        fun preSection(title: String, content: String?): String {
            if (content.isNullOrBlank()) return ""
            return """
              <details>
                <summary>$title</summary>
                <pre>${esc(content)}</pre>
              </details>"""
        }

        return """
            <!doctype html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <style>
                * { box-sizing: border-box; }
                body { font-family: 'Courier New', monospace; background:#0a0a0a; color:#e5e5e5;
                       margin:0; padding:16px; font-size:13px; }
                .banner { background:#7f1d1d; color:#fca5a5; padding:10px 14px; border-radius:8px;
                          margin-bottom:12px; font-size:15px; font-weight:700; }
                .card   { background:#141414; border:1px solid #292929; border-radius:10px;
                          padding:14px; margin-bottom:12px; }
                .card h2 { margin:0 0 10px; font-size:13px; color:#71717a; text-transform:uppercase;
                           letter-spacing:.06em; }
                table   { width:100%; border-collapse:collapse; }
                td      { padding:4px 6px; vertical-align:top; word-break:break-all; }
                td.lbl  { color:#71717a; width:42%; white-space:nowrap; }
                details { margin-top:8px; }
                summary { cursor:pointer; color:#60a5fa; font-size:12px; padding:4px 0; }
                pre     { background:#1a1a1a; border:1px solid #292929; border-radius:6px;
                          padding:10px; overflow-x:auto; white-space:pre-wrap; word-break:break-all;
                          color:#d4d4d4; font-size:11px; margin:6px 0 0; }
                .retry  { display:block; margin-top:14px; background:#22c55e; border:none;
                          color:#08130b; padding:11px 16px; border-radius:8px; font-weight:700;
                          font-size:14px; cursor:pointer; width:100%; }
                .tag    { display:inline-block; background:#1e293b; color:#7dd3fc; border-radius:4px;
                          padding:1px 5px; font-size:11px; margin-right:4px; }
              </style>
            </head>
            <body>
              <div class="banner">⚠ ${esc(getString(R.string.app_name))} – Startup Failed</div>

              <div class="card">
                <h2>App Info</h2>
                <table>
                  ${row("App Version",   s.appVersion)}
                  ${row("API Base URL",  s.apiBaseUrl)}
                </table>
              </div>

              <div class="card">
                <h2>Initialization Steps</h2>
                <table>
                  ${row("Current Step",         s.currentStep)}
                  ${row("Last Successful Step",  s.lastSuccessfulStep)}
                  ${row("Failed Step",           s.failedStep, highlight = true)}
                </table>
              </div>

              <div class="card">
                <h2>Error Details</h2>
                <table>
                  ${row("Exception Message", s.exceptionMessage, highlight = true)}
                  ${row("HTTP Status Code",  s.httpStatusCode?.toString(), highlight = (s.httpStatusCode ?: 0) >= 400)}
                </table>
                ${preSection("📄 Response Body", s.responseBody)}
                ${preSection("🔍 Stack Trace",   s.stackTrace)}
              </div>

              <div class="card">
                <h2>Network</h2>
                <table>
                  ${row("Connectivity", s.networkStatus)}
                </table>
              </div>

              <div class="card">
                <h2>Logcat Tags</h2>
                <span class="tag">[PFTC STARTUP]</span>
                <span class="tag">[PFTC NETWORK]</span>
                <span class="tag">[PFTC ERROR]</span>
                <p style="color:#52525b;margin:6px 0 0;font-size:11px;">
                  Run: <code>adb logcat -s "PFTC STARTUP" "PFTC NETWORK" "PFTC ERROR"</code>
                </p>
              </div>

              <p style="color:#52525b;font-size:11px;margin:0 0 4px;">
                ${esc(message)}
              </p>
              <button class="retry"
                      onclick="location.href='${esc(BuildConfig.APP_URL)}'"
              >${esc(getString(R.string.retry_button))}</button>
            </body>
            </html>
        """.trimIndent()
    }

    /** HTML-escape a string so it's safe to embed in an HTML attribute or text node. */
    private fun esc(value: String?): String = value.orEmpty()
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")
}
