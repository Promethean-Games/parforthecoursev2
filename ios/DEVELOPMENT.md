# iOS Development Roadmap - Technical Implementation Guide

This document provides a detailed technical roadmap for building the Par for the Course iOS app using Swift and WKWebView.

## Project Architecture

```
iOS App (Native Swift)
│
├── WKWebView Wrapper
│   ├── Loads: https://promethean-games.github.io/parforthecoursev2/
│   └── Mirrors Android's MainActivity.kt behavior
│
├── StoreKit 2 Integration
│   ├── Manages in-app purchases
│   ├── Displays paywall after 30-day trial
│   └── Calls backend: /api/billing/apple-iap/verify
│
├── JavaScript Bridge
│   ├── Exposes device ID to web app
│   ├── Handles screen lock (prevent sleep during active scoring)
│   └── Manages native dialogs (purchase sheet)
│
└── Supporting Services
    ├── DeviceID Manager (generate & persist UUID)
    ├── Billing Manager (trial logic, paywall UX)
    └── Logger (crash reporting)
```

---

## Development Phases

### Phase 1: Xcode Project Setup (1 week)

#### 1.1 Create Xcode Project

```
File > New > Project
├── Platform: iOS
├── Template: App
├── Product Name: Par for the Course
├── Organization: Promethean Games
├── Bundle Identifier: com.parforthecourse.app
├── Language: Swift
├── Interfaces: SwiftUI
└── Storage: None (not using Core Data)
```

#### 1.2 Configure Build Settings

**General:**
- Deployment Target: iOS 14.0
- Build Version: 1
- Bundle Identifier: com.parforthecourse.app
- Team: (Your Apple Developer Team ID)
- Version: 1.0.0

**Build Phases:**
- Add "Run Script" to embed web assets (if any)

**Signing & Capabilities:**
- Automatically manage signing: ✅
- Add Capability: **StoreKit**
- Add Capability: **Keychain Sharing** (for secure device ID storage)

**Info.plist:**
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
  <key>NSExceptionDomains</key>
  <dict>
    <key>promethean-games.github.io</key>
    <dict>
      <key>NSIncludesSubdomains</key>
      <true/>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <false/>
      <key>NSExceptionMinimumTLSVersion</key>
      <string>TLSv1.2</string>
    </dict>
  </dict>
</dict>
```

#### 1.3 Folder Structure

```
ParForTheCourse/
├── ParForTheCourse/
│   ├── ParForTheCourseApp.swift       # App entry point
│   ├── ContentView.swift              # Main SwiftUI view
│   ├── Web/
│   │   ├── WebViewContainer.swift     # WKWebView wrapper
│   │   └── JavaScriptBridge.swift     # Web ↔ Native communication
│   ├── Billing/
│   │   ├── BillingManager.swift       # StoreKit 2 + server calls
│   │   ├── PaywallView.swift          # Trial expired UI
│   │   └── ReceiptValidator.swift     # Verify purchases with backend
│   ├── Models/
│   │   ├── Device.swift               # Device ID model
│   │   ├── BillingStatus.swift        # Billing entitlement data
│   │   └── AppConfig.swift            # Environment config
│   ├── Utilities/
│   │   ├── Logger.swift               # Crash logging
│   │   ├── Keychain.swift             # Secure storage
│   │   └── Network.swift              # API calls
│   ├── Assets.xcassets/
│   │   ├── AppIcon.appiconset/
│   │   ├── LaunchScreen/
│   │   └── Images/
│   └── Preview Content/
└── ParForTheCourse.xcodeproj/
```

---

### Phase 2: WKWebView Wrapper (1 week)

#### 2.1 Entry Point - ParForTheCourseApp.swift

```swift
import SwiftUI

@main
struct ParForTheCourseApp: App {
  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}
```

#### 2.2 Main Content View - ContentView.swift

```swift
import SwiftUI

struct ContentView: View {
  @StateObject var deviceManager = DeviceManager.shared
  @StateObject var billingManager = BillingManager.shared
  
  var body: some View {
    ZStack {
      // Web app container
      WebViewContainer(
        deviceManager: deviceManager,
        billingManager: billingManager
      )
      .ignoresSafeArea()
      
      // Paywall overlay (shown when trial expired and not purchased)
      if !billingManager.billingStatus.hasAccess {
        PaywallView(billingManager: billingManager)
          .transition(.opacity)
      }
    }
    .onAppear {
      deviceManager.initializeDeviceID()
      billingManager.checkEntitlementStatus()
    }
  }
}
```

#### 2.3 WKWebView Container - WebViewContainer.swift

```swift
import SwiftUI
import WebKit

struct WebViewContainer: UIViewRepresentable {
  let deviceManager: DeviceManager
  let billingManager: BillingManager
  
  func makeUIView(context: Context) -> WKWebView {
    let config = WKWebViewConfiguration()
    
    // Add JavaScript bridge
    let contentController = config.userContentController
    contentController.add(
      context.coordinator,
      name: "ParForTheCourseNative"
    )
    
    // Security policies
    config.defaultWebpagePreferences.allowsContentJavaScript = true
    config.websiteDataStore = .default()
    
    let webView = WKWebView(frame: .zero, configuration: config)
    webView.navigationDelegate = context.coordinator
    
    // Load the web app
    if let url = URL(string: "https://promethean-games.github.io/parforthecoursev2/") {
      let request = URLRequest(url: url)
      webView.load(request)
    }
    
    return webView
  }
  
  func updateUIView(_ uiView: WKWebView, context: Context) {}
  
  func makeCoordinator() -> Coordinator {
    Coordinator(deviceManager: deviceManager, billingManager: billingManager)
  }
  
  class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    let deviceManager: DeviceManager
    let billingManager: BillingManager
    
    init(deviceManager: DeviceManager, billingManager: BillingManager) {
      self.deviceManager = deviceManager
      self.billingManager = billingManager
    }
    
    // Handle messages from JavaScript
    func userContentController(
      _ userContentController: WKUserContentController,
      didReceive message: WKScriptMessage
    ) {
      guard message.name == "ParForTheCourseNative" else { return }
      
      if let body = message.body as? [String: Any] {
        handleJavaScriptMessage(body)
      }
    }
    
    private func handleJavaScriptMessage(_ message: [String: Any]) {
      guard let action = message["action"] as? String else { return }
      
      switch action {
      case "getDeviceID":
        // Send device ID to web app
        let deviceID = deviceManager.deviceID
        Logger.info("Web app requested device ID: \(deviceID)")
        
      case "checkBillingStatus":
        // Triggered when web app initializes
        billingManager.checkEntitlementStatus()
        
      case "triggerPurchase":
        // User tapped "Purchase" in web app
        billingManager.showPurchaseSheet()
        
      case "lockScreen":
        // Keep screen on during active scoring
        UIApplication.shared.isIdleTimerDisabled = true
        
      case "unlockScreen":
        // Allow screen sleep
        UIApplication.shared.isIdleTimerDisabled = false
        
      default:
        Logger.warn("Unknown action from web app: \(action)")
      }
    }
    
    // Handle navigation events
    func webView(
      _ webView: WKWebView,
      didFinish navigation: WKNavigation!
    ) {
      Logger.info("Web app finished loading")
      
      // Inject device ID into web app
      let deviceID = deviceManager.deviceID
      let script = """
      window.deviceID = "\(deviceID)";
      window.platform = "ios";
      window.appVersion = "1.0.0";
      """
      webView.evaluateJavaScript(script) { _, error in
        if let error = error {
          Logger.error("Failed to inject device ID: \(error)")
        }
      }
    }
    
    func webView(
      _ webView: WKWebView,
      didFail navigation: WKNavigation!,
      withError error: Error
    ) {
      Logger.error("Web view navigation failed: \(error)")
    }
  }
}
```

---

### Phase 3: Device ID Management - DeviceManager.swift

```swift
import Foundation
import Security

class DeviceManager: ObservableObject {
  static let shared = DeviceManager()
  
  @Published var deviceID: String = ""
  
  private let keychainKey = "com.parforthecourse.deviceID"
  
  func initializeDeviceID() {
    // Try to load from Keychain
    if let savedID = loadFromKeychain() {
      self.deviceID = savedID
      return
    }
    
    // Generate new UUID and store in Keychain
    let newID = UUID().uuidString
    saveToKeychain(newID)
    self.deviceID = newID
    
    Logger.info("Generated new device ID: \(newID)")
  }
  
  private func saveToKeychain(_ value: String) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: keychainKey,
      kSecValueData as String: value.data(using: .utf8)!,
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    ]
    
    SecItemDelete(query as CFDictionary)
    SecItemAdd(query as CFDictionary, nil)
  }
  
  private func loadFromKeychain() -> String? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: keychainKey,
      kSecReturnData as String: true,
    ]
    
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    
    if status == errSecSuccess, let data = result as? Data {
      return String(data: data, encoding: .utf8)
    }
    
    return nil
  }
}
```

---

### Phase 4: Billing Manager & StoreKit Integration (1.5 weeks)

#### 4.1 BillingManager.swift

```swift
import Foundation
import StoreKit

class BillingManager: ObservableObject {
  static let shared = BillingManager()
  
  @Published var billingStatus: BillingStatus = BillingStatus()
  @Published var showPurchaseSheet = false
  @Published var isLoading = false
  @Published var errorMessage: String? = nil
  
  private var updateListenerTask: Task<Void, Never>?
  
  nonisolated static let productID = "com.parforthecourse.app.premium_unlock"
  
  func checkEntitlementStatus() {
    Task {
      await fetchStatusFromServer()
      
      // Listen for purchase updates
      await listenForTransactionUpdates()
    }
  }
  
  private func fetchStatusFromServer() async {
    let deviceID = DeviceManager.shared.deviceID
    let urlString = "https://\(backendURL)/api/billing/apple-iap/status?deviceId=\(deviceID)"
    
    guard let url = URL(string: urlString) else { return }
    
    do {
      let (data, _) = try await URLSession.shared.data(from: url)
      let decoder = JSONDecoder()
      let response = try decoder.decode(BillingStatus.self, from: data)
      
      DispatchQueue.main.async {
        self.billingStatus = response
        Logger.info("Billing status updated: hasAccess=\(response.hasAccess)")
      }
    } catch {
      Logger.error("Failed to fetch billing status: \(error)")
      DispatchQueue.main.async {
        self.errorMessage = "Failed to check billing status"
      }
    }
  }
  
  func showPurchaseSheet() {
    Task {
      await MainActor.run {
        self.isLoading = true
      }
      
      do {
        let products = try await Product.products(for: [Self.productID])
        guard let product = products.first else {
          throw NSError(domain: "Product", code: -1, userInfo: nil)
        }
        
        await MainActor.run {
          self.isLoading = false
          self.showPurchaseSheet = true
        }
        
        // Show StoreKit purchase sheet
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
          try await AppStore.showPurchaseSheet(for: product, in: scene)
        }
        
      } catch {
        Logger.error("Failed to load product or show purchase sheet: \(error)")
        await MainActor.run {
          self.isLoading = false
          self.errorMessage = "Failed to load product"
        }
      }
    }
  }
  
  private func listenForTransactionUpdates() async {
    for await update in Transaction.updates {
      let transaction = update.unsafePayloadValue
      
      // Verify and process the transaction
      await handlePurchase(transaction)
      
      // Always finish the transaction
      await update.finish()
    }
  }
  
  private func handlePurchase(_ transaction: Transaction) async {
    guard transaction.productID == Self.productID else { return }
    
    // Send transaction to backend for verification
    await verifyPurchaseWithServer(transaction)
    
    // Refresh billing status
    await fetchStatusFromServer()
  }
  
  private func verifyPurchaseWithServer(_ transaction: Transaction) async {
    let deviceID = DeviceManager.shared.deviceID
    let urlString = "https://\(backendURL)/api/billing/apple-iap/verify"
    
    guard let url = URL(string: urlString) else { return }
    
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let payload = [
      "deviceId": deviceID,
      "transactionId": "\(transaction.id)",
      "bundleId": "com.parforthecourse.app",
    ] as [String: Any]
    
    request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
    
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      
      if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
        Logger.info("Purchase verified on server: transactionId=\(transaction.id)")
      } else {
        Logger.error("Server rejected purchase verification")
      }
    } catch {
      Logger.error("Failed to verify purchase with server: \(error)")
    }
  }
  
  private let backendURL = ProcessInfo.processInfo.environment["BACKEND_URL"] ?? "backend.example.com"
}
```

#### 4.2 BillingStatus Model - BillingStatus.swift

```swift
import Foundation

struct BillingStatus: Codable {
  let hasAccess: Bool
  let isPurchased: Bool
  let trialActive: Bool
  let trialEndsAt: String?
  let daysLeftInTrial: Int?
  let message: String
  let checkedAt: String
  
  init() {
    self.hasAccess = false
    self.isPurchased = false
    self.trialActive = false
    self.trialEndsAt = nil
    self.daysLeftInTrial = nil
    self.message = "Loading..."
    self.checkedAt = ISO8601DateFormatter().string(from: Date())
  }
}
```

#### 4.3 Paywall View - PaywallView.swift

```swift
import SwiftUI

struct PaywallView: View {
  @ObservedObject var billingManager: BillingManager
  
  var body: some View {
    ZStack {
      // Semi-transparent background
      Color.black.opacity(0.5)
        .ignoresSafeArea()
      
      VStack(spacing: 20) {
        VStack(spacing: 12) {
          Text("30-Day Trial Expired")
            .font(.title2)
            .fontWeight(.bold)
          
          Text(billingManager.billingStatus.message)
            .font(.body)
            .foregroundColor(.gray)
        }
        .padding()
        
        // Purchase button
        Button(action: {
          billingManager.showPurchaseSheet()
        }) {
          if billingManager.isLoading {
            ProgressView()
              .foregroundColor(.white)
          } else {
            Text("Purchase $1.99 — Lifetime Access")
              .fontWeight(.semibold)
          }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 50)
        .background(Color.blue)
        .foregroundColor(.white)
        .cornerRadius(8)
        .padding()
        .disabled(billingManager.isLoading)
        
        if let errorMessage = billingManager.errorMessage {
          Text(errorMessage)
            .font(.caption)
            .foregroundColor(.red)
            .padding()
        }
        
        Spacer()
      }
      .frame(maxWidth: 300)
      .padding()
      .background(Color(.systemBackground))
      .cornerRadius(12)
    }
  }
}
```

---

### Phase 5: Testing & Deployment (1 week)

#### 5.1 Local Testing

```swift
// Enable Xcode scheme with test identifiers
// Product > Scheme > Edit Scheme > Run
// Environment Variables (for testing):
// BACKEND_URL=http://localhost:5000
// or BACKEND_URL=https://staging.backend.com
```

**Test cases:**
- [ ] App launches and loads web content
- [ ] Device ID persists across relaunches
- [ ] Trial status displays correctly
- [ ] Purchase sheet launches without crashing
- [ ] Web app receives device ID via JavaScript bridge
- [ ] Screen lock works during active scoring
- [ ] Paywall appears after trial expiration
- [ ] Purchase verification completes without errors

#### 5.2 TestFlight Beta

1. Upload build to App Store Connect
2. Add internal testers
3. Test with Sandbox App Store account
4. Verify IAP purchase works end-to-end

---

## Key Dependencies

### StoreKit 2 (Native)
- No external dependency - built into iOS 15.1+
- Used for in-app purchase flow
- Provides transaction handling and verification

### No External Pods Required
This project intentionally avoids CocoaPods/SPM for dependencies to minimize build complexity.

---

## Environment Variables

**Root `.env` file (not committed):**
```
# Backend
BACKEND_URL=https://api.promethean-games.com

# Apple IAP
APPLE_BUNDLE_ID=com.parforthecourse.app
APPLE_PRODUCT_ID=com.parforthecourse.app.premium_unlock

# Logging
LOG_LEVEL=info
```

---

## Build & Release Process

### Local Build
```bash
# Open in Xcode
open ios/ParForTheCourse/ParForTheCourse.xcodeproj

# Build for simulator
Cmd + B

# Run on simulator
Cmd + R

# Archive for distribution
Product > Archive
```

### App Store Release
```
1. Product > Archive
2. Organizer → Select Archive
3. Distribute App → App Store Connect
4. Upload → Follow wizard
5. Wait for processing (24-48 hours)
6. Resolve any submission issues
7. "Release" to make live
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Could not find module 'StoreKit'" | Ensure StoreKit capability is added in Signing tab |
| Web app not loading | Check URL in WebViewContainer, test in Safari first |
| Purchase sheet won't appear | Verify product ID matches App Store Connect |
| Device ID not persisting | Check Keychain permissions in Info.plist |
| "App transport security" error | Verify https URL and domain exceptions in Info.plist |
| Simulator purchase doesn't work | Use TestFlight on real device for IAP testing |

---

## Performance & Security Considerations

### Performance
- WKWebView uses hardware acceleration for web rendering
- Device ID lookup from Keychain happens once on app launch
- Backend API calls are cached (stale-while-revalidate) if applicable

### Security
- Device ID stored in Keychain (not NSUserDefaults)
- All backend communication via HTTPS
- No sensitive data logged
- Purchase tokens sent to backend for verification (not trusted on client)

---

## Next Steps

1. **Week 1:** Create Xcode project and get Phase 1 complete
2. **Week 2:** Implement WKWebView and JavaScript bridge (Phase 2)
3. **Week 3:** Add StoreKit and BillingManager (Phase 3-4)
4. **Week 4:** Complete testing and prepare for TestFlight
5. **Week 5:** Submit to App Store

**Expected outcome:** iOS app lives on App Store alongside Android, all with 100% feature parity and same billing model.

