# iOS App Store Launch - Quick Reference Checklist

Print this page and track progress as you work through iOS development 🚀

---

## Phase 1: Apple Developer Enrollment ☐
**Timeline:** 1-2 days  
**Owner:** Admin/Legal  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete

- [ ] Create Apple ID at https://appleid.apple.com
- [ ] Enable two-factor authentication
- [ ] Visit https://developer.apple.com/programs/
- [ ] Click "Enroll"
- [ ] Complete legal entity verification
- [ ] Make payment ($99)
- [ ] Wait for approval (24-48 hours)
- [ ] **Share Team ID with team:** `________________`

**Deliverable:** Apple Developer account active + Team ID obtained

---

## Phase 2: Xcode Project Setup ☐
**Timeline:** 1 week  
**Owner:** iOS Developer  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete

### Project Creation
- [ ] Create Xcode project: File > New > Project
- [ ] Product Name: "Par for the Course"
- [ ] Bundle Identifier: `com.parforthecourse.app`
- [ ] Team: (paste Team ID from Phase 1)
- [ ] Language: Swift
- [ ] Interfaces: SwiftUI
- [ ] Deployment Target: iOS 14.0

### Build Configuration
- [ ] Add Capability: **StoreKit**
- [ ] Add Capability: **Keychain Sharing**
- [ ] Configure code signing: Automatic
- [ ] Set version to `1.0.0`
- [ ] Set build number to `1`

### Network Configuration
- [ ] Update Info.plist with app transport security settings
- [ ] Allow domain: `promethean-games.github.io`
- [ ] Require HTTPS: ✓

### Repository
- [ ] Create feature branch: `git checkout -b feature/ios-app-store`
- [ ] Commit Xcode project scaffold
- [ ] Push to origin

**Deliverable:** Xcode project builds and runs on simulator

---

## Phase 3: WKWebView Implementation ☐
**Timeline:** 1 week  
**Owner:** iOS Developer  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete

### Core Components
- [ ] Create `ParForTheCourseApp.swift` (entry point)
- [ ] Create `ContentView.swift` (main UI container)
- [ ] Create `WebViewContainer.swift` (WKWebView wrapper)
- [ ] Implement JavaScript bridge for:
  - [ ] getDeviceID
  - [ ] checkBillingStatus
  - [ ] triggerPurchase
  - [ ] lockScreen / unlockScreen

### Device ID Management
- [ ] Create `DeviceManager.swift`
- [ ] Implement UUID generation
- [ ] Persist to Keychain
- [ ] Load on app startup

### Testing
- [ ] Web app loads in simulator
- [ ] Device ID appears in web app console
- [ ] App doesn't crash on navigation
- [ ] Test on 2+ device simulators (iPhone SE, iPhone 15 Pro)

**Deliverable:** Web app loads in native iOS wrapper, device ID working

---

## Phase 4: In-App Purchases (StoreKit) ☐
**Timeline:** 1.5 weeks  
**Owner:** iOS Developer + Backend  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete

### App Store Connect Setup (Backend/Admin)
- [ ] Create app record in App Store Connect
- [ ] Bundle ID: `com.parforthecourse.app`
- [ ] SKU: `PFTC-001`
- [ ] Category: Sports / Subcategory: Golf
- [ ] Create In-App Purchase product:
  - [ ] Reference Name: "Premium Unlock"
  - [ ] Product ID: `com.parforthecourse.app.premium_unlock`
  - [ ] Type: Managed Product (not subscription)
  - [ ] Price: $1.99

### Backend Preparation
- [ ] Set environment variable: `APPLE_PRODUCT_ID=com.parforthecourse.app.premium_unlock`
- [ ] Set environment variable: `APPLE_BUNDLE_ID=com.parforthecourse.app`
- [ ] Deploy updated `server/billing.ts` to staging
- [ ] Test `GET /api/billing/apple-iap/config` endpoint
- [ ] Test `GET /api/billing/apple-iap/status` endpoint
- [ ] Test `POST /api/billing/apple-iap/verify` endpoint with mock transaction

### iOS Implementation
- [ ] Create `BillingManager.swift`
- [ ] Implement StoreKit 2 product loading
- [ ] Implement purchase sheet display
- [ ] Create `BillingStatus.swift` model
- [ ] Create `PaywallView.swift` UI
- [ ] Test on simulator (no real purchases needed)

### Testing
- [ ] App shows paywall after 30 days (manually fake date)
- [ ] Purchase button launches StoreKit sheet
- [ ] Web app detects paid status
- [ ] No crashes in purchase flow

**Deliverable:** Full IAP flow working end-to-end on staging backend

---

## Phase 5: Android Regression Testing ☐
**Timeline:** Concurrent (throughout phases 3-4)  
**Owner:** QA Team  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete

- [ ] Build Android APK from `main` branch
- [ ] Test on physical device or emulator (API 24+)
- [ ] Verify Google Play billing works:
  - [ ] Trial starts on first launch
  - [ ] Trial countdown displays
  - [ ] Paywall shows after 30 days
  - [ ] Purchase flow completes (use real Play Store sandbox)
- [ ] Verify no regression from backend changes
- [ ] Run before each backend deployment:
  - [ ] Test `GET /api/billing/google-play/status`
  - [ ] Test `GET /api/billing/google-play/config`
  - [ ] Test `POST /api/billing/google-play/verify`

**Deliverable:** Android app continues working with zero impact from iOS work

---

## Phase 6: TestFlight Beta Testing ☐
**Timeline:** 1-2 weeks  
**Owner:** iOS Developer + QA Team  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete

### Build Preparation
- [ ] Update version to `1.0.0`
- [ ] Update build number to `1`
- [ ] Archive in Xcode → Product > Archive
- [ ] Validate archive with App Store

### TestFlight Setup
- [ ] Upload build to App Store Connect
- [ ] Fill out beta review questionnaire
- [ ] Add internal testers (25 available):
  - [ ] List at least 3 QA testers
- [ ] Submit for beta review
- [ ] Wait 24-48 hours for Apple review

### Beta Testing
- [ ] Install TestFlight app on test devices
- [ ] Accept beta invite from testers
- [ ] Install build on physical iPhone (2+ models)
- [ ] Test complete user flow:
  - [ ] App launches without crashes
  - [ ] Web app loads and displays correctly
  - [ ] Score entry works
  - [ ] Leaderboard syncs
  - [ ] Trial countdown accurate
  - [ ] After 30 days: paywall appears
  - [ ] Purchase works (use Sandbox Apple ID with test credits)
  - [ ] Post-purchase: "Unlocked" state persists

### Iteration
- [ ] Document bugs in issue tracker
- [ ] Create hotfixes as needed
- [ ] Build new version for testing
- [ ] Re-test critical paths
- [ ] Iterate until quality acceptable

**Deliverable:** App passes comprehensive testing, ready for App Store submission

---

## Phase 7: App Store Submission Materials ☐
**Timeline:** 3-5 days (concurrent with TestFlight)  
**Owner:** Marketing/Admin + iOS Developer  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete

### Screenshots & Media
- [ ] Capture 5 screenshots for iPhone 6.7" (landscape/portrait)
  - [ ] Screenshot 1: Home screen / game setup
  - [ ] Screenshot 2: Score entry interface
  - [ ] Screenshot 3: Leaderboard
  - [ ] Screenshot 4: Paywall (30-day trial offer)
  - [ ] Screenshot 5: Paywall (purchase $1.99)
- [ ] Capture 5 screenshots for iPhone 5.5" (SE)
- [ ] Optional: Create 30-second app preview video

### App Metadata
- [ ] App description (170 characters max): 
  ```
  _________________ (score tracking golf app)
  ```
- [ ] Keywords: golf, score, caddie, leaderboard, handicap
- [ ] Support email: info@promethean-games.com
- [ ] Privacy policy URL: https://promethean-games.github.io/par-privacy-policy/
- [ ] Support URL: https://promethean-games.com/support

### Content Rating
- [ ] Complete content rating questionnaire
- [ ] Select rating: (likely 4+)

### Release Notes
- [ ] Version 1.0.0 release notes:
  ```
  v1.0: Par for the Course is now available on iOS!
  - Real-time score tracking
  - Live leaderboard syncing
  - 30-day free trial
  - One-time purchase to unlock
  ```

### Legal
- [ ] Privacy Policy document created or referenced
- [ ] Terms of Service document created or referenced
- [ ] EULA accepted
- [ ] App License Agreement: Standard (or custom if needed)

**Deliverable:** All submission materials ready and approved

---

## Phase 8: App Store Submission ☐
**Timeline:** 1-5 days + apple review time  
**Owner:** Admin  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete

### Pre-Submission Checklist
- [ ] All screenshots uploaded
- [ ] App description finalized
- [ ] Privacy policy live and accessible
- [ ] App version set to `1.0.0`
- [ ] Build number ready: `1`
- [ ] Deployment target confirmed: iOS 14.0+
- [ ] No use of private APIs (verified in build log)
- [ ] No background battery drain (verified in testing)

### Submit for Review
- [ ] Go to App Store Connect → Your App
- [ ] Click **"Prepare for Submission"**
- [ ] Ensure all required sections marked complete
- [ ] Export Compliance: Select appropriate (usually "Does not use encryption")
- [ ] Content Rights: Confirm ownership
- [ ] Click **"Submit for Review"**
- [ ] Document submission date/time: `______________`

### During Review
- [ ] Monitor submission status in App Store Connect
- [ ] Expected wait: 24-48 hours (sometimes up to 5 business days)
- [ ] Check email for review status updates
- [ ] Be ready to respond to corrections if requested

### After Approval
- [ ] Review approved notification arrives
- [ ] Click **"Release"** to make live on App Store
- [ ] Confirm app is searchable on App Store within 24 hours
- [ ] Test purchase flow on App Store version
- [ ] Announce launch on social media

**Deliverable:** iOS app live on Apple App Store

---

## Phase 9: Post-Launch Monitoring ☐
**Timeline:** Ongoing (Week 1-2+)  
**Owner:** Admin + Backend  
**Status:** ☐ Not Started ☐ In Progress ☐ Complete

### Day 1 After Launch
- [ ] Monitor App Store reviews (check daily)
- [ ] Verify Apple IAP transactions flowing to backend
- [ ] Check server logs for Apple verification errors
- [ ] Monitor crash reports
- [ ] Test purchase flow on real device post-purchase

### Week 1
- [ ] Respond to user reviews (positive & critical)
- [ ] Track download/install metrics
- [ ] Monitor revenue (Apple pays 70%)
- [ ] Verify no Android regression from concurrent changes

### Ongoing
- [ ] Set up weekly monitoring dashboard:
  - [ ] iOS cumulative revenue
  - [ ] Unique purchasers
  - [ ] Trial-to-paid conversion rate
  - [ ] Compare with Android metrics
- [ ] Maintain parity between iOS and Android feature releases
- [ ] Plan iOS v1.1 improvements based on user feedback

**Deliverable:** Stable iOS distribution, growing user base, revenue tracking

---

## Environment Variables Checklist ☐

### Local Development (Xcode Scheme)
- [ ] `BACKEND_URL` = https://staging.backend.com (or localhost:5000)
- [ ] `APPLE_BUNDLE_ID` = com.parforthecourse.app
- [ ] `APPLE_PRODUCT_ID` = com.parforthecourse.app.premium_unlock

### Production Backend (when iOS live)
- [ ] `APPLE_BUNDLE_ID` = com.parforthecourse.app
- [ ] `APPLE_PRODUCT_ID` = com.parforthecourse.app.premium_unlock
- [ ] `APPLE_KEY_ID` = (from App Store Connect API Keys)
- [ ] `APPLE_ISSUER_ID` = (from App Store Connect API Keys)
- [ ] `APPLE_PRIVATE_KEY` = (secure, from `.p8` file)

### Android (unchanged)
- [ ] `GOOGLE_PLAY_PACKAGE_NAME` = com.parforthecourse.app
- [ ] `GOOGLE_PLAY_PRODUCT_ID` = pftc_premium_unlock
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` = (existing)

---

## Branch & Git Checklist ☐

- [ ] Create feature branch: `git checkout -b feature/ios-app-store`
- [ ] Protect `main` branch (no direct commits)
- [ ] Require PR reviews before merge (minimum 2 reviewers)
- [ ] Configure CI/CD to verify:
  - [ ] Android still builds without errors
  - [ ] TypeScript check passes
  - [ ] Database migration is safe
  - [ ] No conflicts with main branch
- [ ] Before merging feature branch to main:
  - [ ] Android APK built and tested
  - [ ] Google Play billing endpoints verified
  - [ ] All code review comments resolved
  - [ ] Commit messages clear and descriptive

---

## Known Risks & Mitigations ☐

| Risk | Impact | Mitigation | Checked |
|------|--------|-----------|---------|
| Android breaks during iOS dev | High | Feature branch isolation | ☐ |
| Database migration fails | High | Additive columns only, drizzle migration | ☐ |
| App Store rejects iOS app | Medium | Follow submission checklist closely | ☐ |
| Purchase verification fails | Medium | Server-side validation + monitoring | ☐ |
| Timeline delay | Low | No impact on Android, can extend | ☐ |

---

## Key Contacts

**Apple Developer Program:**
- Enrollment Contact: `__________________`
- Team ID: `__________________`

**iOS Development:**
- Lead Developer: `__________________`
- Contact: `__________________`

**Backend/Billing:**
- Lead: `__________________`
- Contact: `__________________`

**QA/Testing:**
- Lead: `__________________`
- Contact: `__________________`

**Marketing/App Store:**
- Lead: `__________________`
- Contact: `__________________`

---

## Timeline Summary

```
Week 1: Apple enrollment + Xcode setup
Week 2: WKWebView implementation
Week 3: StoreKit integration
Week 4: Testing & refinement
Week 5: TestFlight beta
Week 5-6: App Store submission & review
Week 6+: iOS LIVE! 🎉
```

**Expected Launch:** ~6 weeks from start  
**Start Date:** ________________  
**Target Launch:** ________________  

---

## Final Sign-Off

- [ ] This checklist reviewed by project lead
- [ ] All team members assigned
- [ ] Apple enrollment started or complete
- [ ] Ready to begin Phase 1
- [ ] Questions clarified, team understands plan

**Project Lead Signature:** ________________ **Date:** ________

---

**Good luck shipping iOS! 🚀**

For detailed information, reference:
- `iPhone_SETUP.md` — Complete App Store guide
- `ANDROID_STABLE.md` — Branch strategy & protection
- `ios/DEVELOPMENT.md` — Swift code implementation

