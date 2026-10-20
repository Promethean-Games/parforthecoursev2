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

	static var isIOSProductionBuild: Bool {
		(Bundle.main.object(forInfoDictionaryKey: "IOSProductionBuild") as? String)?
			.trimmingCharacters(in: .whitespacesAndNewlines)
			.uppercased() == "YES"
	}

	static var isIOSBillingConfigRequired: Bool {
		(Bundle.main.object(forInfoDictionaryKey: "IOSBillingConfigRequired") as? String)?
			.trimmingCharacters(in: .whitespacesAndNewlines)
			.uppercased() == "YES"
	}

	static var billingAPIURL: String {
		Bundle.main.object(forInfoDictionaryKey: "IOSBillingAPIURL") as? String ?? ""
	}

	static var supabaseAnonKey: String {
		Bundle.main.object(forInfoDictionaryKey: "IOSSupabaseAnonKey") as? String ?? ""
	}

	static func isAllowedAppURL(_ url: URL) -> Bool {
		guard
			let expected = URL(string: appURLString),
			url.scheme == "https",
			url.scheme == expected.scheme,
			url.host == expected.host,
			url.port == expected.port,
			url.user == nil,
			url.password == nil
		else {
			return false
		}

		let allowedPath = expected.path.hasSuffix("/") ? expected.path : "\(expected.path)/"
		return url.path == String(allowedPath.dropLast()) || url.path.hasPrefix(allowedPath)
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
