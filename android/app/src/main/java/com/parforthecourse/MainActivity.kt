package com.parforthecourse

import android.os.Bundle
import android.webkit.WebResourceError
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var showingFallback = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true

            webViewClient = object : WebViewClient() {
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
                        showFallbackPage(getString(R.string.web_unavailable_message))
                    }
                }

                override fun onReceivedHttpError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    errorResponse: WebResourceResponse?
                ) {
                    super.onReceivedHttpError(view, request, errorResponse)
                    if (request?.isForMainFrame == true && (errorResponse?.statusCode ?: 200) >= 400) {
                        showFallbackPage(getString(R.string.web_unavailable_message))
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
                            showFallbackPage(getString(R.string.web_suspended_message))
                        }
                    }
                }
            }
            webChromeClient = WebChromeClient()

            loadUrl(BuildConfig.APP_URL)
        }

        setContentView(webView)

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

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    private fun showFallbackPage(message: String) {
        if (showingFallback) return
        showingFallback = true

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
                <button onclick=\"location.href='${BuildConfig.APP_URL}'\">${getString(R.string.retry_button)}</button>
              </div>
            </body>
            </html>
        """.trimIndent()

        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
    }
}

