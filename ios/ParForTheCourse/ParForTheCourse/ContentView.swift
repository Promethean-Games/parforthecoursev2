import SwiftUI

struct ContentView: View {
	@StateObject private var billingManager = AppleBillingManager()

	var body: some View {
		WebViewContainer(billingManager: billingManager)
			.ignoresSafeArea()
	}
}
