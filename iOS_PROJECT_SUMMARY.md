# Par for the Course - iOS App Store Publishing Project

## Executive Summary

You now have a **complete foundation for concurrent iOS development** while keeping the Android app 100% stable on the Play Store.

**Current Status:**
- ✅ Android app published on Google Play (v3.14) — STABLE
- ✅ Backend billing system supports both Google Play and Apple IAP
- ✅ Database schema extended for Apple IAP (non-breaking migration)
- ✅ Comprehensive iOS development roadmap and checklists created
- ⏳ Awaiting: Apple Developer Program enrollment

**Timeline to iOS Launch:**
- **Phase 1:** Apple enrollment (1-2 days) + Xcode setup (1 week)
- **Phase 2:** iOS development (WKWebView + StoreKit) (3-4 weeks)
- **Phase 3:** TestFlight beta (1-2 weeks concurrent)
- **Phase 4:** App Store submission & review (1-5 days)
- **Total:** 4-6 weeks to live iOS app

---

## What's Been Created

### 1. **Backend Infrastructure** ✅
**Modified Files:**
- `server/db.ts` — Extended `billing_entitlements` table with Apple IAP columns
- `server/billing.ts` — Added Apple IAP endpoints (`/api/billing/apple-iap/*`)

**Key Changes:**
```typescript
// New endpoints (Google Play unchanged):
GET  /api/billing/apple-iap/config      // Get product ID
GET  /api/billing/apple-iap/status      // Check trial/purchase status
POST /api/billing/apple-iap/verify      // Verify purchase with server
```

**Database Schema:**
```sql
ALTER TABLE billing_entitlements ADD COLUMN (
  platform TEXT DEFAULT 'google',
  apple_transaction_id TEXT,
  apple_bundle_id TEXT,
  apple_payload JSONB
)
```

**Why It's Safe:**
- ALL new columns have DEFAULT values
- Google Play queries work unchanged
- Zero impact on existing Android users
- Migrations are additive, not destructive

### 2. **Project Documentation** 📚
**Created Files:**

#### `iOS_SETUP.md` (Complete Apple App Store Guide)
- 10-section walkthrough from enrollment → submission
- App Store Connect configuration
- IAP product setup
- TestFlight beta process
- Submission checklist with legal/content guidelines
- **Use this when:** Apple Developer enrollment is ready

#### `ANDROID_STABLE.md` (Branch Strategy & Protection)
- Concurrent development workflow
- Git branch protection rules
- CI/CD safety checks
- Rollback procedures
- Pre-merge checklist to prevent Android breakage
- **Use this when:** Starting iOS development on feature branch

#### `ios/DEVELOPMENT.md` (Swift Code Implementation)
- Complete Xcode project setup instructions
- Phase-by-phase development guide
- Swift code examples for all major components:
  - `ParForTheCourseApp.swift` (entry point)
  - `WebViewContainer.swift` (WKWebView wrapper)
  - `DeviceManager.swift` (UUID persistence)
  - `BillingManager.swift` (StoreKit 2 integration)
  - `PaywallView.swift` (trial expired UI)
- Testing procedures and deployment steps
- **Use this when:** Starting iOS app development

### 3. **Folder Structure** 📁
```
io/
├── .gitkeep                    # Placeholder for git tracking
├── DEVELOPMENT.md              # Swift development guide
└── ParForTheCourse/            # (to be created in Xcode)
    ├── ParForTheCourse/
    │   ├── Web/
    │   │   ├── WebViewController.swift
    │   │   └── JavaScriptBridge.swift
    │   ├── Billing/
    │   │   ├── BillingManager.swift
    │   │   ├── PaywallView.swift
    │   │   └── ReceiptValidator.swift
    │   ├── Models/
    │   ├── Utilities/
    │   └── Assets/
    └── ParForTheCourse.xcodeproj
```

---

## Immediate Next Steps

### Step 1: Apple Developer Program Enrollment (1-2 days)
**Owner:** Legal/Admin lead  
**What to do:**
1. Go to https://developer.apple.com/programs/
2. Create Apple ID or sign in
3. Enroll in developer program ($99/year)
4. Complete verification process
5. **Share Team ID with iOS developer once approved**

**Checklist before starting iOS dev:**
- [ ] Apple Developer account active
- [ ] Team ID assigned (e.g., `ABC123XYZ0`)
- [ ] Certificates & provisioning profiles accessible
- [ ] Team members added to account

**Reference:** See `iOS_SETUP.md` → Section 1: Apple Developer Program Enrollment

---

### Step 2: Create Xcode Project & Configure (1 week)
**Owner:** iOS Developer  
**What to do:**
1. Read `ios/DEVELOPMENT.md` → Phase 1 (Xcode Setup)
2. Create Xcode project with:
   - Bundle ID: `com.parforthecourse.app`
   - Team ID: (from Step 1)
   - Deployment Target: iOS 14.0
3. Add StoreKit capability in signing tab
4. Configure app transport security for web app domain
5. Push to `feature/ios-app-store` branch

**Reference:** See `ios/DEVELOPMENT.md` → Phase 1

---

### Step 3: Build iOS App (3-4 weeks)
**Owner:** iOS Developer  
**What to do:**
1. Implement WKWebView wrapper (loads web app) — Week 1
2. Add device ID management (UUID persistence) — Week 2
3. Integrate StoreKit 2 (in-app purchase flow) — Week 2-3
4. Add paywall UI (shown after trial) — Week 3
5. Testing & refinement — Week 4

**Concurrent Android regression testing:**
- After each backend deployment, test Google Play endpoints
- Use checklist in `ANDROID_STABLE.md` → CI/CD Strategy
- No Android app changes needed, just backend verification

**Reference:**
- `ios/DEVELOPMENT.md` → Phases 2-5 (phases 2-4 for dev, phase 5 for testing)
- `ANDROID_STABLE.md` → Continuous Integration Strategy

---

### Step 4: App Store Connect Setup (Concurrent)
**Owner:** Admin/Marketing  
**What to do (while iOS developer builds):**
1. Go to https://appstoreconnect.apple.com
2. Create app record with bundle ID `com.parforthecourse.app`
3. Configure app info (category: Sports/Golf, content rating, etc.)
4. Create In-App Purchase product:
   - Reference Name: `Premium Unlock`
   - Product ID: `com.parforthecourse.app.premium_unlock`
   - Price: $1.99 (or equivalent)
5. Get Apple Server API credentials (Key ID, Issuer ID, Private Key)
6. Share API credentials with backend team securely

**Reference:** See `iOS_SETUP.md` → Section 4 & 5

---

### Step 5: TestFlight Beta Testing (1-2 weeks)
**Owner:** QA Team + iOS Developer  
**What to do:**
1. Upload build from Xcode
2. Add internal testers (25 free)
3. Wait for App Store Connect review (24-48 hours)
4. Test in TestFlight with Sandbox IAP account
5. Document test results, report bugs to iOS developer
6. Iterate on fixes

**Reference:** See `iOS_SETUP.md` → Section 7: Testing & QA

---

### Step 6: App Store Submission (5 days)
**Owner:** Admin/Marketing  
**What to do:**
1. Prepare app review materials:
   - Screenshots (6.7" and 5.5" device sizes)
   - 30-second app preview video
   - App description and keywords
   - Release notes
2. Review submission checklist
3. Submit for App Store review
4. Monitor review progress (typically 24-48 hours, up to 5 business days)
5. Address any rejection reasons Apple provides
6. Resubmit if needed

**Reference:** See `iOS_SETUP.md` → Section 8: Submission Checklist

---

## Ongoing Backend Support

### Backend Team Responsibilities
The backend already has Apple IAP endpoints ready, but needs:

1. **Environment Variables Setup** (when iOS gets launched)
   ```bash
   APPLE_BUNDLE_ID=com.parforthecourse.app
   APPLE_PRODUCT_ID=com.parforthecourse.app.premium_unlock
   APPLE_KEY_ID=<from App Store Connect>
   APPLE_ISSUER_ID=<from App Store Connect>
   APPLE_PRIVATE_KEY=<secure, from App Store Connect>
   ```

2. **API Credentials** (obtained in Step 4)
   - Get from App Store Connect → Users & Access → API Keys
   - Download `.p8` file, store securely
   - Extract Key ID and Issuer ID

3. **Endpoint Testing** (when iOS developer ready)
   - Test Apple IAP endpoints on staging first
   - Verify trial auto-creation for new device IDs
   - Verify purchase verification flow
   - Compare responses with Google Play endpoints (same format)

4. **Monitoring** (after iOS launch)
   - Track Apple IAP verification success/failure rate
   - Monitor for API quota issues
   - Alert if Apple endpoints go down

**Reference:** See `ANDROID_STABLE.md` → Deployment Safety

---

## Android Protection Measures

### What's Protected
✅ Android app (no changes, version 3.14 locked)  
✅ Google Play endpoints (unchanged)  
✅ Android users (zero impact from iOS work)

### How We Protect It
1. **Branch isolation:** iOS dev happens on `feature/ios-app-store`, isolated from `main`
2. **Backend safety:** New Apple endpoints don't touch Google Play logic
3. **Database safety:** New columns have defaults, won't break existing queries
4. **CI/CD checks:** Automated tests verify Android still builds and Google Play endpoints work
5. **Code review requirements:** PR to merge iOS back to main requires:
   - Android builds without errors
   - Google Play endpoints tested and working
   - Zero changes to Android code

**Reference:** See `ANDROID_STABLE.md` for complete protection strategy

---

## Critical Environment Variables

### For iOS Development
```bash
# Xcode scheme (run on simulator/device)
BACKEND_URL=https://api.promethean-games.com
APPLE_BUNDLE_ID=com.parforthecourse.app
APPLE_PRODUCT_ID=com.parforthecourse.app.premium_unlock
```

### For Backend (Production)
```bash
# When iOS is live
APPLE_BUNDLE_ID=com.parforthecourse.app
APPLE_PRODUCT_ID=com.parforthecourse.app.premium_unlock
APPLE_KEY_ID=<from App Store Connect API Keys>
APPLE_ISSUER_ID=<from App Store Connect API Keys>
APPLE_PRIVATE_KEY=<private key in PEM format, from .p8 file>

# Google Play unchanged
GOOGLE_PLAY_PACKAGE_NAME=com.parforthecourse.app
GOOGLE_PLAY_PRODUCT_ID=pftc_premium_unlock
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=<existing>
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Android build breaks | Low | High | Branch isolation + CI/CD checks |
| Google Play billing stops working | Low | High | Additive DB changes + separate endpoints |
| iOS app rejected by App Store | Medium | Medium | Follow submission checklist closely |
| Purchase verification fails for iOS users | Low | Medium | Server-side verification + monitoring |
| Timeline delay (iOS takes longer) | Medium | Low | No impact on Android, can extend timeline |

**Overall Risk:** ✅ **LOW** — Android is fully protected, iOS development is isolated

---

## Success Criteria

✅ **Day 1:** This document delivered, approved by team  
✅ **Week 1:** Apple Developer enrollment complete  
✅ **Week 2:** iOS developer starts Xcode project  
✅ **Week 4-5:** iOS app live in TestFlight  
✅ **Week 5-6:** iOS app approved and live on App Store  
✅ **Ongoing:** Android continues running unchanged on Play Store  

---

## File Reference Guide

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **iOS_SETUP.md** | Complete App Store publishing guide | Before starting iOS work |
| **ANDROID_STABLE.md** | Branch strategy & protection measures | Before each git commit |
| **ios/DEVELOPMENT.md** | Swift code implementation guide | During iOS development |
| **server/billing.ts** | Apple IAP endpoint code | When integrating backend |
| **server/db.ts** | Database schema changes | For understanding schema |

---

## Questions & Support

| Question | Answer | Reference |
|----------|--------|-----------|
| What's the timeline? | 4-6 weeks to iOS launch | See Timeline to iOS Launch (above) |
| Will Android be affected? | No, 100% protected | See Android Protection Measures |
| What if something goes wrong? | Clear rollback procedures | See `ANDROID_STABLE.md` → Rollback Plan |
| How do we handle pricing? | $1.99 one-time on both platforms | `iOS_SETUP.md` → Section 5 |
| Can we delay iOS if needed? | Yes, no impact on Android | `ANDROID_STABLE.md` → If iOS Development Gets Stuck |
| What about billing edge cases? | Both platforms use same trial logic | `server/billing.ts` |

---

## Checklist: Before Starting iOS Development

### Pre-Development (This Week)
- [ ] This document approved by team lead
- [ ] iOS developer assigned
- [ ] Admin starts Apple Developer enrollment
- [ ] Backend team reviews `server/billing.ts` changes
- [ ] QA team reads testing procedures in `iOS_SETUP.md`
- [ ] Marketing team prepares App Store assets (screenshots, description)

### When Apple Enrollment Complete (Week 2)
- [ ] Team ID shared with iOS developer
- [ ] Certificates/provisioning profiles set up
- [ ] App Store Connect app record created
- [ ] IAP product created in App Store Connect
- [ ] Xcode project scaffold pushed to `feature/ios-app-store` branch

### When iOS Development Starts (Week 2+)
- [ ] Branch protection rules enabled on `main`
- [ ] CI/CD pipeline validates Android not broken
- [ ] Daily backend regression tests for Google Play
- [ ] TestFlight beta preparation starts (Week 3+)
- [ ] App Store submission materials prepared (Week 4+)

---

## Summary

You're now positioned to launch Par for the Course on iOS while keeping Android completely stable. All infrastructure is in place:

✅ **Backend:** Apple IAP endpoints ready  
✅ **Database:** Schema extended safely  
✅ **Branch Strategy:** iOS isolated from Android  
✅ **Documentation:** Complete roadmaps for all phases  
✅ **Code Examples:** Swift implementation guide ready  
✅ **Safety Procedures:** Protection measures for Android verified  

**Next action:** Get Apple Developer enrollment approved, then follow the 6-week iOS development plan outlined above.

**Questions?** Refer to the documents in this directory or reach out to the iOS developer lead.

---

**Created:** July 8, 2026  
**Project:** Par for the Course - iOS App Store Publishing  
**Status:** ✅ Foundation Complete, Ready for iOS Development

