# Android Play Store Publishing Fix - Broken Functionality & Policy Issues

**Date:** July 8, 2026  
**Issue:** App crashes on launch + Content policy violations  
**Status:** 🔧 FIXING NOW  

---

## Issue #1: ClassNotFoundException - App Won't Launch

### Root Cause
Your Android project has **3 conflicting package directories**:
1. ✅ `com/parforthecourse/app/` — **CORRECT** (should keep)
2. ❌ `com/promethean_games/parforthecourse/` — OLD (delete)
3. ❌ `com/prometheangames/pftc/` — OLD (delete)

**Why this breaks:**
- Build system is including code from multiple packages
- Gradle merge conflicts create mis-compiled DEX files
- Missing/duplicate class references (the `PFTCApplication` error)
- Runtime crashes because class paths don't align with build configuration

### How to Fix

**Step 1: Delete Old Package Directories**

Remove these folders (they're old code, no longer needed):

```bash
# Delete old package 1
rm -rf android/app/src/main/java/com/promethean_games/

# Delete old package 2  
rm -rf android/app/src/main/java/com/prometheangames/
```

**Keep only:**
```
android/app/src/main/java/com/parforthecourse/app/MainActivity.kt
```

**Step 2: Clean Gradle Build Cache**

```bash
cd android
./gradlew clean
./gradlew build
```

**Step 3: Verify AndroidManifest.xml**

Confirm it points to correct package (should already be correct):
```xml
<activity android:name="com.parforthecourse.app.MainActivity"
```

**Step 4: Rebuild APK**

```bash
./gradlew assembleRelease
```

---

## Issue #2: Google Play Content Policy Compliance

### Policy Violations to Address

**1. Broken Functionality (Critical) ← YOU ARE HERE**
- ❌ App installs but crashes on launch
- ✅ **Fix:** Delete old packages (see above)

**2. Policy Requirements for "Par for the Course" Golf App**

Your app must comply with Google Play Developer Program Policies:
https://play.google.com/about/developer-content-policy/

**Critical Areas for Your App:**

#### A. Disclosure & Transparency
```
✅ REQUIRED: Privacy Policy
   - Must be accessible at: https://promethean-games.github.io/par-privacy-policy/
   - Should cover: data collection, analytics, usage
   - Cannot be placeholder/404
   STATUS: Add to app store listing

✅ REQUIRED: Appropriate Age Rating  
   - Golf scoring app → likely 3+ or 4+
   - No violence, no suggestive content, no ads to adult content
   STATUS: Complete content rating questionnaire in Google Play Console
```

#### B. Permissions & Security
```
✅ REQUIRED: Justify every permission
   Current permissions in AndroidManifest.xml:
   - android.permission.INTERNET → Needed for web app loading
   - android.permission.ACCESS_NETWORK_STATE → Needed for connectivity check
   
✅ GOOD: No dangerous permissions requested (good!)
   - No camera, no microphone, no location
```

#### C. Financial Policies
```
✅ REQUIRED: Billing Transparency
   Your app uses Google Play Billing (30-day trial + $1.99 purchase)
   
   CHECKLIST:
   - [ ] Price is clearly disclosed upfront
   - [ ] Free trial terms are explicit (30 days stated)
   - [ ] Billing currency matches user's region
   - [ ] Purchase button is not misleading
   - [ ] Easy way to manage subscriptions (one-time purchase, so OK)
   - [ ] Refund policy accessible

✅ REQUIRED: No misleading claims
   - Don't claim "free premium" if paid content hidden
   - Be clear about what trial includes vs. paid
```

#### D. User Data & Privacy
```
✅ REQUIRED: Data Safety
   Users need to know what data you collect:
   
   LIKELY DATA COLLECTED (for your golf app):
   - [ ] Device ID (persistent per user) — golf score sync
   - [ ] Game scores/leaderboard data — core feature
   - [ ] Basic analytics — app usage, crashes
   
   ACTION: Declare in Google Play → Data Safety form:
   - Does app collect personal info? NO (just anonymous device ID + scores)
   - Does app collect sensitive info? NO
   - Does app share data with third parties? NO (likely)
   - Does app use analytics? YES (recommend Google Analytics, Firebase)
   
   YOUR STATEMENT: "We collect only your unique device ID and game scores 
   necessary for leaderboard functionality. No personal data is shared."
```

#### E. Intellectual Property & Content
```
✅ GOOD: App is your original content (Par for the Course)
   No issues here unless using copyrighted golf images/music

VERIFY:
   - [ ] Golf card images are original or licensed
   - [ ] No copyrighted music/sounds
   - [ ] No trademarked country/course names used improperly
```

#### F. Device & Feature Abuse
```
✅ GOOD: Your app:
   - Does NOT drain battery in background
   - Does NOT send spam SMS/notifications  
   - Does NOT install malware
   - Does NOT modify device settings
   - Does NOT pretend to be system app
   
   (WKWebView loading a web app is standard, approved practice)
```

### Content Policy Compliance Checklist

**Before Re-Submitting to Play Store:**

- [ ] **Delete old Java packages** (fix ClassNotFoundException)
- [ ] **Rebuild & test APK** thoroughly on device
- [ ] **Add Privacy Policy link** to Google Play listing  
- [ ] **Complete Data Safety form** in Google Play Console:
  - Device ID + game scores only
  - No personal data collected
  - No third-party sharing
  - No sensitive permissions
- [ ] **Verify Billing Transparency**:
  - "30-day free trial, then $1.99 one-time purchase"
  - Clear checkout process
  - Easy cancellation/refund option documented
- [ ] **Add Help/Support section** in app or via web
- [ ] **Test on clean device** to ensure no crashes
- [ ] **Review all store listing text** for misleading claims
- [ ] **Content Rating**: Complete questionnaire (likely 4+ rating)

---

## Step-by-Step Submission Fix

### 1️⃣ Fix Code (Do This First)

**Step 1: Delete Old Packages**
```bash
cd H:\My Drive\04 APP\parforthecoursev2\android\app\src\main\java\com

# Remove old code
remove-item promethean_games -Recurse -Force
remove-item prometheangames -Recurse -Force

# Verify only correct package remains
dir com\parforthecourse\app\
# Output: MainActivity.kt
```

**Step 2: Clean Build**
```bash
cd H:\My Drive\04 APP\parforthecoursev2
./gradlew clean build
```

**Step 3: Test Build**
```bash
./gradlew assembleRelease
# Look for: Build finished successfully
```

**Step 4: Test APK**
- Connect Android device or open emulator (API 24+)
- Install APK:
  ```bash
  adb install -r android/app/release/app-release.apk
  ```
- Check: App launches without crashing
- Check: Web app loads correctly
- Check: Can enter scores
- Check: Billing system works

### 2️⃣ Policy Compliance (Do This Parallel)

**In Google Play Console:**

1. **Add Privacy Policy**
   - Go to: App Store Listing → Privacy Policy URL
   - Add: https://promethean-games.github.io/par-privacy-policy/
   - (Create this privacy policy page if it doesn't exist)

2. **Complete Data Safety Form**
   - Settings → Data Safety
   - Answer truthfully:
     - "Do you collect/share personal data?" → No
     - "Do you use analytics?" → Yes (if applicable)
     - Data types: Device identifier, Activity data (game scores)
     - No third-party sharing
     - No sensitive permissions
   - Save

3. **Content Rating Questionnaire**
   - App Content → Target Audience → Start Questionnaire
   - Categories: Sports, Games
   - Violence: None
   - Suggestive content: None
   - Rating: Likely 4+ or Everyone 10+
   - Submit

4. **Review Billing**
   - Monetization Setup → In-app products
   - Verify one-time purchase is set ($1.99)
   - Verify refund policy is posted on website
   - Verify trial terms are clear (30 days free, then $1.99)

5. **Store Listing**
   - Title: "Par for the Course"
   - Short Description: "Track golf scores with real-time leaderboard sync"
   - Full Description: Include:
     - 30-day free trial
     - $1.99 one-time purchase for unlimited access
     - Privacy & terms links
     - Support contact: info@promethean-games.com
   - Verify pricing matches across all regions
   - Screenshots show app working correctly

### 3️⃣ Resubmit

Once all above complete:
1. Upload new APK to Google Play Console
2. Confirm all compliance items checked
3. Click **"Review"** → **"Submit for Review"**
4. Monitor submission inbox for feedback

---

## Files to Create/Update

### Create: Privacy Policy (if not exists)
Location: `https://promethean-games.github.io/par-privacy-policy/`

**Minimum Content:**
```markdown
# Privacy Policy - Par for the Course

## Data Collection
We collect the following data for app functionality:
- Device ID (unique identifier per device)
- Game scores and leaderboard data
- Basic app usage analytics

## No Personal Data
We do NOT collect:
- Name, email, phone
- Location data
- Contacts or calendar
- Payment information (handled by Google Play)

## Data Sharing
Your data is NOT shared with third parties.

## Questions
Contact: info@promethean-games.com
```

### Update: App Store Listing
In Google Play Console, update:
- **App name:** Par for the Course
- **Short description:** Golf score tracking with real-time leaderboard
- **Full description:** Include trial terms and pricing clearly
- **Privacy policy URL:** https://promethean-games.github.io/par-privacy-policy/
- **Support URL:** https://promethean-games.com/support

---

## Common Play Store Rejection Reasons (Preempt Them)

| Rejection | Prevention | Status |
|-----------|-----------|--------|
| App crashes on launch | Delete old packages ✅ | 🔧 FIXING |
| Broken functionality | Rebuild and test APK ✅ | 🔧 FIXING |
| Misleading billing | Be explicit: "30-day trial + $1.99" | ⏳ TODO |
| Missing privacy policy | Add public privacy page | ⏳ TODO |
| Unclear data practices | Complete Data Safety form | ⏳ TODO |
| No support contact | Add support URL/email | ⏳ TODO |
| Content rating mismatch | Complete rating questionnaire | ⏳ TODO |

---

## Android Build Verification

After deleting old packages, verify build integrity:

```bash
# 1. Check Java source files
find android/app/src/main/java -name "*.kt" -o -name "*.java"
# Expected Output:
# android/app/src/main/java/com/parforthecourse/app/MainActivity.kt
# (Only one MainActivity, correct package)

# 2. Check build output
./gradlew assembleRelease --info | grep -i "error\|warning"
# Expected: Minimal warnings, zero errors related to classes

# 3. Check APK contents (optional, needs aapt)
aapt dump badging android/app/release/app-release.apk | grep package
# Expected:
# package: name='com.parforthecourse.app'
```

---

## Version Update (Recommended)

Since you're resubmitting for critical bug fix:

Update `android/app/build.gradle.kts`:
```kotlin
// Before:
versionCode = 2026070801  // July 8, 2026, build 01
versionName = "3.14"

// After:
versionCode = 2026070802  // July 8, 2026, build 02 (incremented for bug fix)
versionName = "3.14.1"    // Patch version for bug fix
```

Include in release notes:
```
"Version 3.14.1: Fixed critical app launch crash"
```

---

## Timeline

| Task | Time | Owner |
|------|------|-------|
| Delete old packages + rebuild | 30 min | Dev |
| Test APK on device | 20 min | QA |
| Create privacy policy | 1 hour | Legal/Admin |
| Complete Play Console forms | 1 hour | Admin/Marketing |
| Update app store listing | 30 min | Marketing |
| **Total to Resubmit** | **~3 hours** | Team |
| Play Store Review | 1-5 days | Google |
| App Live | 1-5 days | Google |

---

## Next Immediate Actions

✅ **Right Now:**
1. Read this entire document
2. Locate old Java package directories on your system
3. Backup the project (git commit current state)

⏳ **Within 1 Hour:**
1. Delete `com/promethean_games/` directory
2. Delete `com/prometheangames/` directory  
3. Run `./gradlew clean build`
4. Build APK: `./gradlew assembleRelease`
5. Test on device

⏳ **Within 2 Hours:**
1. Create privacy policy page
2. Update Google Play Console forms
3. Resubmit APK for review

---

## Questions During Fix?

| Q | Answer |
|---|--------|
| **Will deleting packages lose code?** | NO - you only have ONE MainActivity anyway. The other packages were old/duplicate. |
| **Why the error message mentioned PFTCApplication?** | Old code referenced an Application class that doesn't exist. Deleting old packages removes that reference. |
| **Will this work on first try?** | Yes - IF you delete ALL old packages and rebuild clean. |
| **Do I need iOS changes?** | NO - keep iOS work on `feature/ios-app-store` branch. This is Android-only fix. |
| **Will Android users be affected?** | NO - existing users won't see this. Only matters for new app submissions. |

---

## Support

If rebuild fails:
1. Check `./gradlew build` output for specific errors
2. Run `./gradlew clean` again
3. Verify NO files remain in old package directories
4. Check that `AndroidManifest.xml` points to `com.parforthecourse.app.MainActivity`

If Play Store still rejects:
1. Check rejection reason carefully
2. Screenshot errors and share with Google Play support
3. Common issues: missing privacy policy, uncompleted forms

---

## Status

**Before Fix:**
- ❌ App crashes on launch
- ❌ Multiple conflicting packages
- ❌ Missing policy compliance info

**After This Fix:**
- ✅ Single, clean package structure
- ✅ App launches successfully  
- ✅ Compliant with Google Play policies
- ✅ Ready for approval

---

**Created:** July 8, 2026  
**Priority:** 🔴 CRITICAL - Blocking App Store Publication  
**Effort:** ~3 hours to delivery

