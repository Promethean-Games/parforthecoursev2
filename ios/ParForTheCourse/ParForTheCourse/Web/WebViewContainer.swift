import SwiftUI
import UIKit
import WebKit

struct WebViewContainer: UIViewRepresentable {
	let billingManager: AppleBillingManager

	func makeCoordinator() -> Coordinator {
		Coordinator(billingManager: billingManager)
	}

	func makeUIView(context: Context) -> WKWebView {
		let config = WKWebViewConfiguration()
		let controller = config.userContentController

		// Keep the web app unchanged by exposing the Android bridge name on iOS.
		let bridgeScript = """
		(function() {
		  if (window.AndroidScreenSecurity) return;
		  window.AndroidScreenSecurity = {
			setCardVisibility: function(key, visible) {
			  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.AndroidScreenSecurity) {
				window.webkit.messageHandlers.AndroidScreenSecurity.postMessage({ action: 'setCardVisibility', key: key, visible: !!visible });
			  }
			},
			setCardsVisible: function(visible) {
			  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.AndroidScreenSecurity) {
				window.webkit.messageHandlers.AndroidScreenSecurity.postMessage({ action: 'setCardsVisible', visible: !!visible });
			  }
			}
		  };
		})();
		"""

		controller.addUserScript(
			WKUserScript(source: bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
		)
		let platformFlag = AppConfig.isIOSProductionBuild ? "true" : "false"
		let platformScript = """
		Object.defineProperty(window, '__PFTC_IOS_PRODUCTION__', {
		  value: \(platformFlag),
		  writable: false,
		  configurable: false
		});
		"""
		controller.addUserScript(
			WKUserScript(source: platformScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
		)
		controller.add(context.coordinator, name: "AndroidScreenSecurity")
		controller.add(context.coordinator, name: "PFTCiOSBilling")

		config.defaultWebpagePreferences.allowsContentJavaScript = true
		let webView = WKWebView(frame: .zero, configuration: config)

		context.coordinator.bind(webView: webView)
		webView.navigationDelegate = context.coordinator
		webView.uiDelegate = context.coordinator

		StartupDiagnostics.initialize(appVersion: AppConfig.appVersionLabel, appURL: AppConfig.appURLString)
		StartupDiagnostics.stepStarted("WebView setup")
		StartupDiagnostics.stepSucceeded("WebView setup")

		context.coordinator.loadAppURL()
		return webView
	}

	func updateUIView(_ uiView: WKWebView, context: Context) {
		// No-op: app is fully driven by web state and native delegate callbacks.
	}

	final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
		private weak var webView: WKWebView?
		private let billingManager: AppleBillingManager
		private var retriedInitialLoad = false
		private var showingFallback = false
		private var secureOverlayKeys = Set<String>()

		init(billingManager: AppleBillingManager) {
			self.billingManager = billingManager
		}

		func bind(webView: WKWebView) {
			self.webView = webView
			billingManager.emit = { [weak self] event in
				self?.dispatch(event)
			}
		}

		func loadAppURL() {
			guard let webView else { return }
			showingFallback = false
			retriedInitialLoad = false
			secureOverlayKeys.removeAll()
			applySecureState()
			StartupDiagnostics.stepStarted("Loading APP_URL: \(AppConfig.appURLString)")
			webView.load(URLRequest(url: AppConfig.appURL))
		}

		func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
			StartupDiagnostics.stepStarted("Page loading: \(webView.url?.absoluteString ?? "unknown")")
		}

		func webView(
			_ webView: WKWebView,
			decidePolicyFor navigationAction: WKNavigationAction,
			decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
		) {
			guard navigationAction.targetFrame?.isMainFrame == true,
				let url = navigationAction.request.url,
				AppConfig.isAllowedAppURL(url)
			else {
				decisionHandler(.cancel)
				return
			}
			decisionHandler(.allow)
		}

		func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
			if navigationResponse.isForMainFrame,
				let url = navigationResponse.response.url,
				!AppConfig.isAllowedAppURL(url)
			{
				decisionHandler(.cancel)
				return
			}
			if let response = navigationResponse.response as? HTTPURLResponse, response.statusCode >= 400 {
				StartupDiagnostics.stepFailed(step: "Main frame HTTP response", message: "HTTP \(response.statusCode)", httpStatusCode: response.statusCode)
				decisionHandler(.cancel)
				handleMainFrameLoadFailure(message: "The app is temporarily unavailable. Please try again.")
				return
			}
			decisionHandler(.allow)
		}

		func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
			guard !showingFallback else { return }
			StartupDiagnostics.stepSucceeded("Page loaded: \(webView.url?.absoluteString ?? "unknown")")

			webView.evaluateJavaScript("document.body ? document.body.innerText.toLowerCase() : ''") { [weak self] value, _ in
				guard let self else { return }
				let text = (value as? String) ?? ""
				if text.contains("service has been suspended by its owner") {
					StartupDiagnostics.stepFailed(step: "Page content check", message: "Service suspension marker detected")
					self.showFallbackPage(message: "The online service for this app is currently suspended. Please restore hosting and try again.")
				}
			}
		}

		func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
			StartupDiagnostics.stepFailed(step: "Navigation failed", message: error.localizedDescription, error: error)
			handleMainFrameLoadFailure(message: "The app is temporarily unavailable. Please try again.")
		}

		func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
			StartupDiagnostics.stepFailed(step: "Provisional navigation failed", message: error.localizedDescription, error: error)
			handleMainFrameLoadFailure(message: "The app is temporarily unavailable. Please check your connection and try again.")
		}

		func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
			guard message.frameInfo.isMainFrame,
				let messageURL = message.frameInfo.request.url,
				AppConfig.isAllowedAppURL(messageURL)
			else {
				return
			}

			if message.name == "PFTCiOSBilling" {
				guard let raw = message.body as? String,
					let data = raw.data(using: .utf8),
					let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
				else {
					return
				}
				Task { @MainActor [weak self] in
					await self?.billingManager.handle(body)
				}
				return
			}

			guard message.name == "AndroidScreenSecurity",
				let body = message.body as? [String: Any],
				let action = body["action"] as? String
			else {
				return
			}

			switch action {
			case "setCardVisibility":
				guard let key = body["key"] as? String else { return }
				let visible = (body["visible"] as? Bool) ?? false
				if visible { secureOverlayKeys.insert(key) } else { secureOverlayKeys.remove(key) }
				applySecureState()
			case "setCardsVisible":
				let visible = (body["visible"] as? Bool) ?? false
				if visible { secureOverlayKeys.insert("cards") } else { secureOverlayKeys.remove("cards") }
				applySecureState()
			default:
				return
			}
		}

		private func dispatch(_ event: [String: Any]) {
			guard let webView,
				let data = try? JSONSerialization.data(withJSONObject: event, options: [.fragmentsAllowed]),
				let json = String(data: data, encoding: .utf8)
			else {
				return
			}
			webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('pftc-ios-billing', { detail: \(json) }));")
		}

		private func handleMainFrameLoadFailure(message: String) {
			guard let webView else { return }

			if !retriedInitialLoad {
				retriedInitialLoad = true
				StartupDiagnostics.stepStarted("Retry load (600 ms delay)")
				DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
					guard let self, !self.showingFallback else { return }
					StartupDiagnostics.stepStarted("Retry: Loading APP_URL")
					webView.load(URLRequest(url: AppConfig.appURL))
				}
				return
			}

			StartupDiagnostics.dump()
			showFallbackPage(message: message)
		}

		private func applySecureState() {
			// iOS has no direct FLAG_SECURE equivalent. Keep screen awake while protected content is visible.
			UIApplication.shared.isIdleTimerDisabled = !secureOverlayKeys.isEmpty
		}

		private func showFallbackPage(message: String) {
			guard let webView, !showingFallback else { return }
			showingFallback = true

			let diagnostics = StartupDiagnostics.currentState()
			let detailLine: String
			if AppConfig.diagnosticMode {
				detailLine = "<p style='font-size:12px;color:#9ca3af'>step=\(escape(diagnostics.failedStep)) | network=\(escape(diagnostics.networkStatus))</p>"
			} else {
				detailLine = ""
			}

			let html = """
			<!doctype html>
			<html>
			<head>
			  <meta name='viewport' content='width=device-width, initial-scale=1' />
			  <style>
				body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f0f0f; color: #f5f5f5; margin: 0; padding: 24px; }
				.card { max-width: 480px; margin: 20vh auto 0; padding: 20px; background: #1a1a1a; border-radius: 12px; }
				h1 { margin-top: 0; font-size: 22px; }
				p { color: #d4d4d4; line-height: 1.45; }
				button { margin-top: 16px; background: #22c55e; border: none; color: #08130b; padding: 10px 14px; border-radius: 8px; font-weight: 600; }
			  </style>
			</head>
			<body>
			  <div class='card'>
				<h1>\(escape(AppConfig.appName))</h1>
				<p>\(escape(message))</p>
				\(detailLine)
				<button onclick="location.href='\(escape(AppConfig.appURLString))'">Try again</button>
			  </div>
			</body>
			</html>
			"""

			webView.loadHTMLString(html, baseURL: nil)
		}

		private func escape(_ text: String) -> String {
			text
				.replacingOccurrences(of: "&", with: "&amp;")
				.replacingOccurrences(of: "<", with: "&lt;")
				.replacingOccurrences(of: ">", with: "&gt;")
				.replacingOccurrences(of: "\"", with: "&quot;")
				.replacingOccurrences(of: "'", with: "&#39;")
		}
	}
}
