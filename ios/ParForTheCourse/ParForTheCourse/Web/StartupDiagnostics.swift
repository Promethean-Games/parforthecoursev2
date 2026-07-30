import Foundation
import Network

enum StartupDiagnostics {
	struct State {
		var appVersion = ""
		var appURL = ""
		var currentStep = "Not started"
		var lastSuccessfulStep = "None"
		var failedStep = "None"
		var exceptionMessage: String?
		var httpStatusCode: Int?
		var networkStatus = "Unknown"
	}

	private static var state = State()
	private static let monitor = NWPathMonitor()
	private static let monitorQueue = DispatchQueue(label: "com.parforthecourse.network.monitor")
	private static var monitorStarted = false

	static func initialize(appVersion: String, appURL: String) {
		state = State(appVersion: appVersion, appURL: appURL)
		log("[PFTC STARTUP] Initialized appVersion=\(appVersion) appURL=\(appURL)")

		if !monitorStarted {
			monitorStarted = true
			monitor.pathUpdateHandler = { path in
				let status = describe(path)
				state.networkStatus = status
				log("[PFTC NETWORK] \(status)")
			}
			monitor.start(queue: monitorQueue)
		}
	}

	static func currentState() -> State { state }

	static func stepStarted(_ step: String) {
		state.currentStep = step
		log("[PFTC STARTUP] Start: \(step)")
	}

	static func stepSucceeded(_ step: String) {
		state.lastSuccessfulStep = step
		state.currentStep = "\(step) [ok]"
		log("[PFTC STARTUP] Success: \(step)")
	}

	static func stepFailed(step: String, message: String, httpStatusCode: Int? = nil, error: Error? = nil) {
		state.failedStep = step
		state.exceptionMessage = message
		state.httpStatusCode = httpStatusCode
		if let error {
			log("[PFTC ERROR] \(step) message=\(message) error=\(error.localizedDescription)")
		} else {
			log("[PFTC ERROR] \(step) message=\(message)")
		}
	}

	static func dump() {
		let s = state
		log("[PFTC STARTUP] current=\(s.currentStep) last=\(s.lastSuccessfulStep) failed=\(s.failedStep)")
		log("[PFTC NETWORK] \(s.networkStatus)")
		if let exception = s.exceptionMessage {
			log("[PFTC ERROR] exception=\(exception)")
		}
		if let status = s.httpStatusCode {
			log("[PFTC ERROR] httpStatus=\(status)")
		}
	}

	private static func describe(_ path: NWPath) -> String {
		let transport: String
		if path.usesInterfaceType(.wifi) {
			transport = "WiFi"
		} else if path.usesInterfaceType(.cellular) {
			transport = "Cellular"
		} else if path.usesInterfaceType(.wiredEthernet) {
			transport = "Ethernet"
		} else {
			transport = "Other"
		}
		return "\(transport) | status=\(path.status)"
	}

	private static func log(_ message: String) {
		print(message)
	}
}

