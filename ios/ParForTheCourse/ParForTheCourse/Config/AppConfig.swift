import Foundation

enum AppConfig {
	static let appName = "Par for the Course"

	static var appURLString: String {
		Bundle.main.object(forInfoDictionaryKey: "AppURL") as? String
			?? "https://promethean-games.github.io/parforthecoursev2/"
	}

	static var appURL: URL {
		URL(string: appURLString)!
	}

	static var diagnosticMode: Bool {
		if let flag = Bundle.main.object(forInfoDictionaryKey: "DiagnosticMode") as? Bool {
			return flag
		}
		if let flagString = Bundle.main.object(forInfoDictionaryKey: "DiagnosticMode") as? String {
			return (flagString as NSString).boolValue
		}
		return false
	}

	static var appVersionLabel: String {
		let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
		let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
		return "\(version) (\(build))"
	}
}


