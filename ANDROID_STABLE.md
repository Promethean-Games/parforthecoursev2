# Android Build Stability & Concurrent iOS Development

This document defines how we'll develop iOS **concurrently** while keeping the Android build **100% stable** and production-ready.

## Strategy Overview

**Goal:** Develop iOS app on a feature branch WITHOUT touching Android code or shared backend logic that affects production.

**Key Principle:** 
- `main` branch is **always** a stable Android release
- `feature/ios-app-store` branch is **isolated** iOS development
- Only shared code changes are backend endpoints (Apple IAP added alongside Google Play, not replacing it)

---

## Git Branch Structure

```
main (Production)
│
├── android/                    ✅ STABLE - No changes
│   └── app/
│       └── build.gradle.kts   # VERSION 3.14 - LOCKED
│
└── shared code (indexed below)
    ├── server/billing.ts       ✅ BACKWARDS COMPATIBLE
    ├── server/db.ts           ✅ DATABASE MIGRATION SAFE
    └── package.json           ✅ NEW DEPS FOR iOS ONLY

feature/ios-app-store (Development)
│
├── ios/                        ✨ NEW - iOS app lives here
│   └── ParForTheCourse/
│       └── [Xcode project]
│
├── server/billing.ts           ✅ Apple IAP endpoints ADDED (Google Play untouched)
├── server/db.ts               ✅ Database schema extended (migrations are additive)
└── feature-branch-only/       🚫 Never merged back
    └── ios-specific-deps/
```

---

## What DOES Change (Safe)

### 1. Database Schema (`server/db.ts`)

**Type:** Additive migration
**Risk:** ✅ NONE - Existing Google Play logic unaffected

**Changes:**
```sql
-- New columns (optional, non-breaking)
ALTER TABLE billing_entitlements 
  ADD COLUMN platform TEXT DEFAULT 'google',
  ADD COLUMN apple_transaction_id TEXT,
  ADD COLUMN apple_bundle_id TEXT,
  ADD COLUMN apple_payload JSONB DEFAULT '{}';
```

**Safe because:**
- ALL columns have DEFAULT values
- Google Play queries continue working unchanged
- `SELECT * FROM billing_entitlements WHERE device_id = $1` works for both Android & iOS
- Zero data migration needed

**Android impact:** ✅ None - Column exists but is never touched by Android app

### 2. Backend Routes (`server/billing.ts`)

**Type:** Additive endpoints
**Risk:** ✅ NONE - Google Play endpoints completely untouched

**New endpoints:**
- `GET /api/billing/apple-iap/config` — iOS only
- `GET /api/billing/apple-iap/status` — iOS only
- `POST /api/billing/apple-iap/verify` — iOS only

**Safe because:**
- Google Play endpoints remain unchanged:
  - `GET /api/billing/google-play/config`
  - `GET /api/billing/google-play/status`
  - `POST /api/billing/google-play/verify`
- Android app ONLY calls Google Play endpoints
- iOS app ONLY calls Apple IAP endpoints
- No shared business logic affected

**Testing required:**
```bash
# After deploying updated billing.ts:
# 1. Test Android on Google Play Sandbox
#    curl http://backend/api/billing/google-play/status?deviceId=test-android
#    Result: ✅ Trial auto-starts as before
#
# 2. Test iOS on Apple Sandbox (once iOS app built)
#    curl http://backend/api/billing/apple-iap/status?deviceId=test-ios
#    Result: ✅ Trial auto-starts as before
#
# 3. No regression on Android production users
```

### 3. Package Dependencies (`package.json`)

**Type:** New optional dependencies
**Risk:** ✅ NONE - No changes to existing deps

**Added (for iOS development):**
```json
// These will be added only when iOS dev starts
// For now, leave as-is
```

**Safe because:**
- New deps won't break `npm ci` for existing deployments
- Backend `npm install` continues to work
- Node.js version unchanged (18.x)

---

## What DOES NOT Change (Protected)

### ❌ DO NOT TOUCH

1. **Android code:**
   ```
   android/app/build.gradle.kts  ← VERSION 3.14 - LOCKED
   android/app/src/main/         ← No changes
   ```

2. **Shared library versions:**
   ```json
   // package.json - Do NOT update these:
   "react": "^18.3.1",
   "express": "^4.21.2",
   "drizzle-orm": "^0.39.1",
   // (all existing deps stay same)
   ```

3. **Google Play billing logic:**
   ```typescript
   // server/billing.ts
   // ✅ Keep completely intact:
   app.get("/api/billing/google-play/config", ...)
   app.get("/api/billing/google-play/status", ...)
   app.post("/api/billing/google-play/verify", ...)
   ```

4. **Database schema (old columns):**
   ```sql
   -- ✅ Keep these (Android still uses them):
   device_id, trial_started_at, trial_ends_at, is_purchased,
   purchase_token, product_id, package_name, purchase_state, play_payload
   ```

---

## Branching & PR Workflow

### Creating Feature Branch

```bash
# Main is production (Android latest)
git checkout main
git pull origin main

# Create isolated iOS development branch
git checkout -b feature/ios-app-store
```

### Committing iOS Work

```bash
# Commits should be small, reviewable, focused:

git commit -m "chore: create ios/ directory structure"
git commit -m "chore: update server/db.ts with Apple IAP columns (non-breaking)"
git commit -m "feat: add Apple IAP endpoints to server/billing.ts"
git commit -m "docs: add iOS_SETUP.md and branch strategy guide"

# iOS-specific:
git commit -m "feat(ios): scaffold ParForTheCourse Xcode project"
git commit -m "feat(ios): implement WKWebView wrapper"
git commit -m "feat(ios): integrate StoreKit for IAP"
```

### Before Merging Back to Main

**Required steps (enforced in code review):**

1. **✅ Android Build Test**
   ```bash
   # On main branch, verify Android still builds:
   cd android
   ./gradlew clean build
   # Should work exactly as before
   ```

2. **✅ Backend Regression Test**
   ```bash
   # On feature/ios-app-store, deploy to staging
   # Test Google Play endpoint with real Android device:
   curl https://staging.backend/api/billing/google-play/status?deviceId=android-test
   # Should return: { hasAccess, isPurchased, trialActive, ... }
   ```

3. **✅ Database Migration Safe**
   ```bash
   # Verify:
   # - All new columns have DEFAULT values
   # - No columns removed
   # - Existing queries still work
   # - Drizzle migration scripts generated correctly
   npm run db:push  # Should succeed without data loss
   ```

4. **✅ Code Review Checklist**
   - [ ] No Android files modified
   - [ ] No changes to Google Play endpoints
   - [ ] Database migrations are additive only
   - [ ] iOS code follows Swift best practices
   - [ ] Backend endpoints tested on staging
   - [ ] Documentation is complete

### Pull Request

```
Title: "feat: ios app store publishing preparation"

Description:
- Adds iOS project structure under ios/ directory
- Extends database schema for Apple IAP (non-breaking)
- Implements Apple IAP endpoints (Google Play unchanged)
- Includes comprehensive iOS setup guide and branch strategy
- Android build verified stable
- Database migrations tested
- Ready for iOS development on feature/ios-app-store

Testing:
- ✅ Android gradle build successful
- ✅ Google Play billing endpoints working
- ✅ Database schema extends without breaking changes
- ✅ Backend deploys to staging and tested
```

---

## Continuous Integration Strategy

### For Main Branch

**Every push to main must pass:**

```yaml
# .github/workflows/android-stability.yml
name: Android Stability Check

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  android-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Android Release
        run: |
          cd android
          ./gradlew clean build -x test
          # Must succeed - no Android changes allowed to main
      - name: Verify Google Play Billing
        run: |
          # Quick smoke test of Google Play endpoints
          npm run check
```

### For iOS Feature Branch

**Every push to feature/ios-app-store:**

```yaml
# .github/workflows/ios-precheck.yml
name: iOS Development Check

on:
  push:
    branches: [feature/ios-app-store]

jobs:
  backend-safety:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Verify Android Not Modified
        run: |
          if git diff --name-only origin/main | grep -E '^android/'; then
            echo "ERROR: Android code modified in iOS branch!"
            exit 1
          fi
      - name: Check Database Safe
        run: |
          npm run check
          # Verify db.ts schema is additive only
  
  backend-compile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: TypeScript Check
        run: npm run check
      - name: Verify Billing Endpoints
        run: |
          # Quick parse of billing.ts to ensure endpoints don't conflict
          grep -c "app.get.*google-play" server/billing.ts  # Should be 2
          grep -c "app.post.*google-play" server/billing.ts # Should be 1
          grep -c "app.get.*apple-iap" server/billing.ts    # Should be 2
          grep -c "app.post.*apple-iap" server/billing.ts   # Should be 1
```

---

## Deployment Safety

### Deploying Backend with iOS Branch (`feature/ios-app-store`)

**Scenario:** Backend pulled from `feature/ios-app-store` to staging/production

**Safety checks before deployment:**

1. **Google Play still works:**
   ```bash
   # Hit production Google Play endpoint from staging
   curl https://staging.backend/api/billing/google-play/status?deviceId=production-user
   # Should work exactly as before (no latency, same response)
   ```

2. **Database migration is reversible:**
   ```sql
   -- Worst case, rollback drops new columns:
   ALTER TABLE billing_entitlements 
    DROP COLUMN platform,
    DROP COLUMN apple_transaction_id,
    DROP COLUMN apple_bundle_id,
    DROP COLUMN apple_payload;
   -- Google Play data remains untouched
   ```

3. **Environment variables ready for Apple IAP:**
   ```bash
   # Backend checks for these (if not set, Apple endpoints return errors, not crashes):
   APPLE_BUNDLE_ID            # com.parforthecourse.app
   APPLE_PRODUCT_ID           # com.parforthecourse.app.premium_unlock
   APPLE_KEY_ID               # From App Store Connect API
   APPLE_ISSUER_ID            # From App Store Connect API
   APPLE_PRIVATE_KEY          # Secure secret, not yet needed
   ```

### Deploying to Production

**Only when:**
1. ✅ iOS app approved and live on App Store
2. ✅ 1+ week of iOS users successfully purchasing
3. ✅ Zero complaints from Android users
4. ✅ Feature branch merged to main

**Deployment order:**
```
1. Deploy backend with Apple IAP endpoints (already in main)
2. All Android users continue unaffected
3. iOS users hit Apple endpoints exclusively
4. Google and Apple IAP can coexist forever (separate endpoint paths)
```

---

## Rollback Plan (If Needed)

### If Backend Breaks Android Play Billing

**Symptoms:**
- Android users report "Purchase verification failed"
- Google Play endpoints returning errors
- Entitlements not creating for new Android devices

**Rollback:**
```bash
# Option 1: Revert backend to previous commit
git revert <commit-breaking-google-play>
git push origin main

# Option 2: Hotfix on main (if feature branch is at fault)
git checkout main
git hotfix fix/google-play-regression
# Fix applied, tested, merged to main & feature/ios-app-store
```

### If iOS Development Gets Stuck

**Simply abandon feature branch:**
```bash
git checkout main
git branch -D feature/ios-app-store
# Android is unaffected, all iOS work is discarded
# No risk to production
```

---

## Monitoring & Alerting

### Set up monitoring for Android billing

```typescript
// server/monitoring.ts (recommended)
// Alert if Google Play endpoints fail for >5 consecutive requests
app.get("/api/billing/google-play/status", async (req, res) => {
  try {
    // existing code
  } catch (error) {
    console.error("CRITICAL: Google Play status failed", { ...error });
    // Send Slack/PagerDuty alert
    notifyOps("Android billing endpoint down");
    return res.status(500).json({ error: "Service unavailable" });
  }
});
```

### Dashboard to track by platform

```sql
-- Query to verify health of both platforms
SELECT 
  platform,
  COUNT(*) as device_count,
  SUM(CASE WHEN is_purchased THEN 1 ELSE 0 END) as paid_users,
  SUM(CASE WHEN is_purchased = false AND trial_ends_at > NOW() THEN 1 ELSE 0 END) as trial_active
FROM billing_entitlements
GROUP BY platform;

-- Result:
-- platform | device_count | paid_users | trial_active
-- google   | 5000         | 1200       | 2000
-- apple    | 0            | 0          | 0     (until iOS launches)
```

---

## Checklist Before Merging feature/ios-app-store → main

- [ ] Android APK builds without any changes
- [ ] Android app tested on physical device (Play Store purchase works)
- [ ] `npm run check` passes (no TypeScript errors)
- [ ] Database migration tested (additive schema safe)
- [ ] Backend deployed to staging and tested
- [ ] Google Play endpoints return identical responses as before
- [ ] Code review approved by at least 1 other dev
- [ ] iOS code review approved by iOS developer
- [ ] Commit messages are clear and descriptive
- [ ] Documentation updated (iOS_SETUP.md, README.md)
- [ ] No merge conflicts with main
- [ ] Branch is up-to-date with main before merge
- [ ] All GitHub CI checks pass

---

## Summary

| Aspect | Android | iOS | Shared Backend |
|--------|---------|-----|----------------|
| **Location** | `android/` | `ios/` (NEW) | `server/`, `shared/` |
| **Branch** | main | feature/ios-app-store | Both |
| **Billing Endpoint** | `/api/billing/google-play/*` | `/api/billing/apple-iap/*` | Separate endpoints |
| **Database Columns** | Existing (unchanged) | New (additive columns) | Extended schema |
| **Risk During Merge** | ✅ None | ⚠️ Minimal (reviewed) | ✅ Backwards compatible |
| **Rollback Time** | N/A | Seconds (branch delete) | Minutes (revert commit) |

**Bottom line:** Android is **100% protected** during iOS development because iOS code is isolated on a feature branch and only additive backend changes are made.

---

## Questions?

- **When can I start iOS development?** → Once this document is approved and Apple Developer enrollment is complete
- **Will iOS changes break Android?** → No, assuming review checklist followed
- **What if iOS launch gets delayed?** → No impact on Android, stays on main as-is
- **Can we deploy iOS backend changes early?** → Yes, to staging only, full regression test before prod

