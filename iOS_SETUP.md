# iOS App Store Publishing Setup

This document outlines the complete process for publishing Par for the Course to the Apple App Store, running concurrently with Android development.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Apple Developer Program Enrollment](#1-apple-developer-program-enrollment)
3. [Project Structure](#2-project-structure)
4. [Xcode Configuration](#3-xcode-configuration)
5. [App Store Connect Setup](#4-app-store-connect-setup)
6. [In-App Purchase (IAP) Configuration](#5-in-app-purchase-iap-configuration)
7. [Development Steps](#6-development-steps)
8. [Testing & QA](#7-testing--qa)
9. [Submission Checklist](#8-submission-checklist)
10. [Post-Launch](#9-post-launch)

---

## Prerequisites

**Required (before starting):**
- ✅ Active Apple Developer Program membership ($99/year)
  - Enroll at: https://developer.apple.com/programs/
  - Team ID assigned by Apple
  - Certificates, Identifiers, and Profiles access
- ✅ Mac with Xcode 15+ installed
- ✅ Familiarity with Swift and iOS development (or developer on team)
- ✅ Backend team ready to implement Apple IAP verification

**Already in place:**
- ✅ React web app hosted at `https://promethean-games.github.io/parforthecoursev2/`
- ✅ Android app published on Google Play (keep this stable)
- ✅ Backend billing server ready for Apple IAP endpoints
- ✅ Database schema extended for Apple IAP support

---

## 1. Apple Developer Program Enrollment

### Step 1: Create an Apple Account
1. Go to https://appleid.apple.com
2. Create a new Apple ID or sign in with existing account
3. Verify email and set up two-factor authentication (required for app distribution)

### Step 2: Enroll in Apple Developer Program
1. Visit https://developer.apple.com/programs/
2. Click **"Enroll"**
3. Follow the enrollment process:
   - Confirm your legal entity (individual, company, etc.)
   - Verify contact information
   - Accept agreements and complete payment ($99)
4. Wait for Apple's approval (usually 24-48 hours)

### Step 3: Set Up Team and Certificates
Once enrolled:
1. Go to **Apple Developer Dashboard** → **Certificates, Identifiers & Profiles**
2. Create an **App ID** (see step 3 below)
3. Create signing certificates and provisioning profiles
4. Download certificates to your Mac

**Expected Team ID:** Will be provided by Apple (e.g., `ABC123XYZ0`)

---

## 2. Project Structure

The iOS project will live under `ios/` at the root level, mirroring Android structure:

```
parforthecoursev2/
├── android/                    # Existing (keep stable)
│   └── app/
├── ios/                        # NEW - iOS app
│   ├── ParForTheCourse/        # Main Xcode project
│   │   ├── ParForTheCourse/    # App target
│   │   │   ├── App.swift       # Entry point
│   │   │   ├── WebViewController.swift
│   │   │   ├── BillingManager.swift
│   │   │   └── Assets/
│   │   ├── ParForTheCourse.xcodeproj
│   │   └── ParForTheCourse.xcworkspace
│   ├── README.md               # iOS-specific setup
│   └── .gitignore
├── server/                     # Backend (updated for Apple IAP)
│   ├── billing.ts              # Apple IAP endpoints added
│   └── ...
├── iOS_SETUP.md                # This file
└── ANDROID_STABLE.md           # Branch strategy
```

---

## 3. Xcode Configuration

### Step 1: Create Xcode Project Locally

When ready to begin development:

```bash
# This will be done in Xcode GUI, but here's the checklist:
# File > New > Project
# Choose: iOS > App
# Product Name: "Par for the Course"
# Team: (your enrolled team from Apple)
# Organization: Promethean Games
# Bundle Identifier: com.parforthecourse.app
# Language: Swift
# Interfaces: SwiftUI
```

### Step 2: Configure Build Settings

**General tab:**
- Bundle ID: `com.parforthecourse.app`
- Version: `1.0.0`
- Build: `1` (Maps to iOS v1.0.0-build1)
- Deployment Target: iOS 14.0+ (to reach ~99% of App Store user base)
- Team: Your enrolled team ID

**Signing & Capabilities tab:**
- Signing Certificate: Automatic (Xcode managed)
- Provisioning Profile: Automatic
- Add Capability: **StoreKit** (for in-app purchases)

**Build Phases:**
- Embed Web Assets (load from `https://promethean-games.github.io/parforthecoursev2/`)

### Step 3: Environment Variables

Create a local `ios/ParForTheCourse/Config.xcconfig` file:

```swift
// Config.xcconfig
APP_URL = https://promethean-games.github.io/parforthecoursev2/
APPLE_BUNDLE_ID = com.parforthecourse.app
APPLE_PRODUCT_ID = com.parforthecourse.app.premium_unlock
```

---

## 4. App Store Connect Setup

### Step 1: Create App Record

1. Go to **App Store Connect** (https://appstoreconnect.apple.com)
2. Click **"My Apps"** → **"+"** → **"New App"**
3. Fill in details:
   - **Platform:** iOS
   - **App Name:** "Par for the Course"
   - **Primary Language:** English
   - **Bundle ID:** com.parforthecourse.app (created in step 3)
   - **SKU:** `PFTC-001` (unique identifier)

### Step 2: Configure App Information

In **App Store Connect** → **Your App** → **App Information**:

- **Category:** Sports
- **Subcategory:** Golf
- **Content Rating:** Tap to complete (likely 4+)
- **Privacy Policy URL:** https://promethean-games.github.io/par-privacy-policy/
- **Support URL:** https://promethean-games.com/support
- **App Support Email:** info@promethean-games.com

### Step 3: Version & Release Notes

- **Release Notes:** "Version 1.0 - Par for the Course is now available on iOS! [Include feature highlights]"
- **Copyright:** © [Year] Promethean Games

---

## 5. In-App Purchase (IAP) Configuration

### Step 1: Create IAP Product in App Store Connect

1. **App Store Connect** → **Your App** → **In-App Purchases**
2. Click **"+Create"** → **Managed Product** (NOT subscription)
3. Configure:
   - **Reference Name:** `Premium Unlock`
   - **Product ID:** `com.parforthecourse.app.premium_unlock`
   - **Pricing:** Tier 1 (approx. $1.99 USD)
   - **Availability:** Available in all territories
   - **Screenshots:** Provide if needed
   - **Description:** "Unlock the full Par for the Course app. One-time purchase, lifetime access."

### Step 2: Update Backend Environment Variables

On your server, set:

```bash
# In your hosting platform (Render, Railway, etc.)
APPLE_BUNDLE_ID=com.parforthecourse.app
APPLE_PRODUCT_ID=com.parforthecourse.app.premium_unlock
APPLE_KEY_ID=<from App Store Connect>
APPLE_ISSUER_ID=<from App Store Connect>
APPLE_PRIVATE_KEY=<PEM format private key from App Store Connect>
```

**Getting Apple credentials:**
1. **App Store Connect** → **Users & Access** → **Integrations** → **App Store Connect API Keys**
2. Generate new key with **Developer** access
3. Download and store securely (`.p8` file)

---

## 6. Development Steps

### Phase 1: WKWebView Wrapper (Week 1-2)

Build the native iOS shell that loads the web app:

**File: `ios/ParForTheCourse/ParForTheCourse/App.swift`** (Entry point)
```swift
import SwiftUI

@main
struct ParForTheCourseApp: App {
  var body: some Scene {
    WindowGroup {
      WebViewController()
    }
  }
}
```

**File: `ios/ParForTheCourse/ParForTheCourse/WebViewController.swift`** (Web loader)
- Load React web app from `https://promethean-games.github.io/parforthecoursev2/`
- Add JavaScript bridge for native features (device ID, screen lock, etc.)
- Mirror Android's `MainActivity.kt` logic

### Phase 2: StoreKit Integration (Week 2-3)

Implement in-app purchase flow:

**File: `ios/ParForTheCourse/ParForTheCourse/BillingManager.swift`**
- Use StoreKit 2 framework (modern Apple IAP API)
- Request product info from `com.parforthecourse.app.premium_unlock`
- Handle purchase sheet, transactions, and verification
- Call server endpoint: `POST /api/billing/apple-iap/verify` after purchase
- Display paywall when trial expires

### Phase 3: Testing & Refinement (Week 3-4)

- Local testing on simulator
- TestFlight internal testing (first 25 testers free)
- Beta feedback and bug fixes
- Prepare submission assets (screenshots, app preview video)

---

## 7. Testing & QA

### Local Testing Checklist

- [ ] App loads web experience correctly
- [ ] Device ID is captured and consistent
- [ ] First app launch: Trial starts automatically
- [ ] Trial countdown displays correctly
- [ ] After 30 days: Paywall shows "Purchase to Unlock"
- [ ] In-app purchase flow works (use Sandbox testing)
- [ ] After purchase: "Unlocked" state persists
- [ ] Offline fallback works (if no internet)
- [ ] Navigation, score entry all work as in web/Android

### TestFlight Testing (Sandbox)

1. **App Store Connect** → **Your App** → **TestFlight**
2. Add up to 25 internal testers (Apple dev team members)
3. Build and submit for beta review (24-48 hours)
4. Testers install via TestFlight app and test with Sandbox purchases
5. Use special Sandbox account credentials to test IAP without real charges

**Sandbox Testing URLs:**
- Most endpoints work normally (point to production backend)
- IAP transactions: Use TestFlight's Sandbox payment method
- No real money charged

### Regression Testing (Android)

After each iOS change:
1. Build Android release APK
2. Test on multiple Android devices (minSdk 24)
3. Verify Google Play billing still works
4. Ensure no shared code introduced bugs

---

## 8. Submission Checklist

**Before hitting "Submit for Review" in App Store Connect:**

### App Information
- [ ] App name finalized and approved internally
- [ ] Description is clear, keyword-rich
- [ ] Category: Sports / Subcategory: Golf
- [ ] Content rating completed (likely 4+)
- [ ] Keywords set (golf, score, caddy, leaderboard, etc.)
- [ ] Support URL provided (404 is fine if placeholder)
- [ ] Privacy policy accessible

### Build & Testing
- [ ] Final build uploaded and processed by App Store
- [ ] Build passes App Store Connect validation
- [ ] All required device testing completed
- [ ] No crashes or major bugs in TestFlight
- [ ] Accessibility testing (VoiceOver, text sizes, etc.)

### App Store Submission
- [ ] App Preview (30-second video) added (optional but recommended)
- [ ] Screenshots for each device size:
  - 6.7" (iPhone 15 Pro Max)
  - 5.5" (iPhone SE)
  - iPad (if supporting iPad)
- [ ] Release notes filled in
- [ ] Advertising ID (IDFA) declared if tracking enabled
- [ ] App License Agreement accepted
- [ ] EULA provided (can be simple)

### IAP & Security
- [ ] In-App Purchase product created and approved
- [ ] Pricing set correctly ($1.99 or equivalent)
- [ ] Server-side purchase verification implemented
- [ ] Apple IAP credentials stored securely in backend
- [ ] Test purchase completed successfully

### Compliance
- [ ] App does not use private/undocumented APIs
- [ ] No battery-draining logic runs in background
- [ ] Data privacy declaration is accurate
- [ ] Usage of location, camera, contacts = none (if app doesn't need them)

### Legal
- [ ] Terms of Service on promethean-games.com
- [ ] Privacy Policy on promethean-games.com
- [ ] COPPA compliance (if any users under 13) — likely not needed
- [ ] Export compliance (ECCN) — likely not needed for a golf app

---

## 9. Submission Process

1. **App Store Connect** → **Your App** → **Prepare for Submission**
2. Ensure all required sections are filled
3. Click **"Add for Review"** up to 50 devices (leave as-is)
4. Complete app info summary
5. Export Compliance: "Does not use encryption" (or set correctly if it does)
6. Content Rights: Confirm you own content
7. **Submit for Review**
8. Wait for Apple review (typically 24-48 hours, sometimes up to 5 business days)

**Review Notes to Apple:**
```
This is the iOS version of Par for the Course, a scorekeeping app for 
golfers. The app features a 30-day free trial, after which users can 
make a one-time in-app purchase to unlock the full experience. 

Features include:
- Real-time score entry
- Leaderboard syncing
- Handicap tracking
- Tournament management

Test Account (if required):
- Email: testuser@example.com
- Password: [TestPassword123]

Backend: https://promethean-games.com/api/
```

---

## 10. Post-Launch

### After App Approval

1. **Press Release:** Announce iOS launch on social media
2. **Update Web App:** Add AppStore badge/link
3. **Monitor Reviews:** Check App Store reviews daily for first week
4. **Version & Build Numbering:** Plan next release
   - v1.0 (build 1) ← Initial iOS release
   - v1.1 (build 2) ← Bug fixes / improvements
   - v1.2 (build 3) ← Feature parity with Android if needed
   - etc.

### Ongoing Maintenance

- **Security Updates:** iOS 17+ requirements change yearly
- **Feature Parity:** Keep iOS and Android in sync
- **Pricing Alignment:** Monitor if Android pricing changes, update iOS
- **Backend Monitoring:** Track Apple IAP verification failures

---

## Branch Strategy & Git Workflow

To keep Android stable during iOS development, use feature branches:

```bash
# Main branch — always production-ready, Android stable
main
├── feature/ios-app-store      # iOS development (branched from main)
│   ├── ios-setup              # Xcode project scaffold
│   ├── ios-webview-wrapper    # WKWebView implementation
│   ├── ios-storekit           # In-app purchase integration
│   └── ios-billing-endpoints   # Backend Apple IAP support
│
# Merged back to main only after approval & testing
```

**Example workflow:**

```bash
# Start iOS Feature Branch
git checkout -b feature/ios-app-store

# Create iOS directory structure
mkdir ios
# ... Xcode project created here ...

# Commit in small, reviewable chunks
git commit -m "chore: scaffold iOS Xcode project"
git commit -m "feat: implement WKWebView wrapper for web app loading"
git commit -m "backend: add Apple IAP verification endpoints"

# Before merging back:
# 1. Full Android regression testing
# 2. iOS TestFlight beta testing complete
# 3. Code review required
git push origin feature/ios-app-store
# → Create Pull Request
# → Reviewers verify, Android is still building correctly
# → Merge to main
```

---

## Timeline Summary

| Phase | Duration | Owner | Deliverable |
|-------|----------|-------|-------------|
| Apple Enrollment | 1-2 days | Legal/Admin | Team ID, certificates |
| Project Setup & Xcode Config | 1 week | iOS Dev | Xcode project, build settings |
| WKWebView Wrapper | 1 week | iOS Dev | Web app loads in native shell |
| StoreKit Integration & Billing | 1.5 weeks | iOS Dev + Backend | IAP, paywall, verification |
| Testing & QA | 1 week | QA Team | All scenarios tested |
| Submission Prep & Assets | 3-5 days | Marketing + iOS Dev | Screenshots, description, video |
| App Store Review | 1-5 days | Apple | App approval |
| **Total to Launch** | **~4-5 weeks** | Cross-team | iOS app live on App Store |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Team ID not found" | Confirm enrollment at https://developer.apple.com and check ID in Settings |
| Bundle ID conflict | Change from `com.parforthecourse.app` if already taken (rare) |
| IAP not appearing in App Store Connect | Wait 24 hours after build upload; use correct product ID |
| TestFlight app not showing build | Submit build for beta review; wait 24-48 hours |
| "App uses API that is no longer supported" | Ensure Xcode 15+, target iOS 14.0+; avoid deprecated APIs |
| Crash on app launch (simulator) | Check WKWebView loads correctly; test web URL manually |

---

## Next Steps

1. **Week 1: Get Apple Developer enrollment approved** → Share Team ID with team
2. **Week 2: iOS developer sets up Xcode project** → Push to `feature/ios-app-store` branch
3. **Week 3: Implement WKWebView & StoreKit** → Run concurrent Android regression tests
4. **Week 4: TestFlight beta** → QA testing in parallel
5. **Week 5: Submit to App Store** → Monitor review status
6. **Post-Approval: Launch day!** → Announce, monitor reviews

---

## References

- **Apple Developer Docs:** https://developer.apple.com/documentation/
- **StoreKit 2 Guide:** https://developer.apple.com/documentation/storekit
- **App Store Review Guidelines:** https://developer.apple.com/app-store/review/guidelines/
- **App Store Connect Help:** https://help.apple.com/app-store-connect/
- **Par for the Course Backend:** `/server/billing.ts` (Apple IAP endpoints)

