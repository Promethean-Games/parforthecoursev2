package com.parforthecourse.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log

/**
 * Singleton that tracks every startup step and provides rich Logcat output.
 *
 * Tags used:
 *   [PFTC STARTUP] – lifecycle / step progress
 *   [PFTC NETWORK] – connectivity details
 *   [PFTC ERROR]   – failures, exceptions, HTTP errors
 *
 * Enable/disable via BuildConfig.DIAGNOSTIC_MODE (true for debug, false for release).
 */
object StartupDiagnostics {

    const val TAG_STARTUP = "PFTC STARTUP"
    const val TAG_NETWORK = "PFTC NETWORK"
    const val TAG_ERROR   = "PFTC ERROR"

    // ── Immutable snapshot of diagnostic state ───────────────────────────────
    data class State(
        val appVersion: String        = "",
        val apiBaseUrl: String        = "",
        val currentStep: String       = "Not started",
        val lastSuccessfulStep: String = "None",
        val failedStep: String        = "None",
        val exceptionMessage: String? = null,
        val httpStatusCode: Int?      = null,
        val responseBody: String?     = null,
        val stackTrace: String?       = null,
        val networkStatus: String     = "Unknown"
    )

    @Volatile
    var state = State()
        private set

    // ── Initialise with app meta-data ─────────────────────────────────────────
    fun init(appVersion: String, apiBaseUrl: String) {
        state = State(appVersion = appVersion, apiBaseUrl = apiBaseUrl)
        Log.i(TAG_STARTUP, "══════════════════════════════════════════")
        Log.i(TAG_STARTUP, "  PFTC Startup Diagnostics – Initialised  ")
        Log.i(TAG_STARTUP, "══════════════════════════════════════════")
        Log.i(TAG_STARTUP, "App Version : $appVersion")
        Log.i(TAG_STARTUP, "API Base URL: $apiBaseUrl")
    }

    // ── Step tracking ─────────────────────────────────────────────────────────
    fun stepStarted(step: String) {
        state = state.copy(currentStep = step)
        Log.i(TAG_STARTUP, "▶ Step started   : $step")
    }

    fun stepSucceeded(step: String) {
        state = state.copy(
            lastSuccessfulStep = step,
            currentStep        = "$step  ✓"
        )
        Log.i(TAG_STARTUP, "✓ Step succeeded : $step")
    }

    fun stepFailed(
        step: String,
        exceptionMessage: String? = null,
        httpStatusCode: Int?      = null,
        responseBody: String?     = null,
        throwable: Throwable?     = null
    ) {
        val stackTrace = throwable?.stackTraceToString()
        state = state.copy(
            failedStep       = step,
            exceptionMessage = exceptionMessage ?: throwable?.message,
            httpStatusCode   = httpStatusCode,
            responseBody     = responseBody,
            stackTrace       = stackTrace
        )

        Log.e(TAG_ERROR, "╔══════════════════════════════════════════")
        Log.e(TAG_ERROR, "║  PFTC Startup FAILURE                    ")
        Log.e(TAG_ERROR, "╚══════════════════════════════════════════")
        Log.e(TAG_ERROR, "  Failed Step    : $step")
        exceptionMessage?.let { Log.e(TAG_ERROR, "  Exception      : $it") }
        throwable?.message?.let { if (it != exceptionMessage) Log.e(TAG_ERROR, "  Throwable Msg  : $it") }
        httpStatusCode?.let     { Log.e(TAG_ERROR, "  HTTP Status    : $it") }
        responseBody?.let       { Log.e(TAG_ERROR, "  Response Body  : $it") }
        stackTrace?.let         { Log.e(TAG_ERROR, "  Stack Trace:\n$it") }
        Log.e(TAG_ERROR, "  Network        : ${state.networkStatus}")
    }

    // ── Network helpers ───────────────────────────────────────────────────────
    fun updateNetworkStatus(context: Context) {
        val status = queryNetworkStatus(context)
        state = state.copy(networkStatus = status)
        Log.i(TAG_NETWORK, "Network status: $status")
    }

    private fun queryNetworkStatus(context: Context): String {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return "No active network"
        val caps    = cm.getNetworkCapabilities(network) ?: return "Active network – no capability info"
        val transport = when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)     -> "WiFi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)      -> "VPN"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH)-> "Bluetooth"
            else -> "Other"
        }
        val internet  = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        val validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        return "$transport | internet=$internet | validated=$validated"
    }

    // ── Full dump (call on any key event, e.g. retry tapped) ─────────────────
    fun dumpToLogcat() {
        val s = state
        Log.i(TAG_STARTUP, "──────────────────────────────────────────")
        Log.i(TAG_STARTUP, "  PFTC Diagnostic Dump                    ")
        Log.i(TAG_STARTUP, "──────────────────────────────────────────")
        Log.i(TAG_STARTUP, "App Version          : ${s.appVersion}")
        Log.i(TAG_STARTUP, "API Base URL         : ${s.apiBaseUrl}")
        Log.i(TAG_STARTUP, "Current Step         : ${s.currentStep}")
        Log.i(TAG_STARTUP, "Last Successful Step : ${s.lastSuccessfulStep}")
        Log.i(TAG_STARTUP, "Failed Step          : ${s.failedStep}")
        Log.i(TAG_NETWORK, "Network Status       : ${s.networkStatus}")
        s.exceptionMessage?.let { Log.e(TAG_ERROR, "Exception Message    : $it") }
        s.httpStatusCode?.let   { Log.e(TAG_ERROR, "HTTP Status Code     : $it") }
        s.responseBody?.let     { Log.e(TAG_ERROR, "Response Body        : $it") }
        s.stackTrace?.let       { Log.e(TAG_ERROR, "Stack Trace:\n$it") }
        Log.i(TAG_STARTUP, "──────────────────────────────────────────")
    }
}

