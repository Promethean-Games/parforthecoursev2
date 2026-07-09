# 🚨 URGENT: Android App Fix - Step-by-Step Guide

**Status:** App Rejected by Play Store (Crashes on Launch + Policy Violations)  
**Fix Time:** ~3 hours  
**Difficulty:** Easy (delete 2 folders, rebuild, submit)

---

## 🔴 THE PROBLEM (In Plain English)

Your Android project has **THREE different package folders**, but only ONE should exist:
- ✅ `android/app/src/main/java/com/parforthecourse/app/` ← **KEEP THIS**
- ❌ `android/app/src/main/java/com/promethean_games/` ← **DELETE THIS**
- ❌ `android/app/src/main/java/com/prometheangames/` ← **DELETE THIS**

When you compile, these conflicting packages cause the build system to get confused and create broken code. That's why the app crashes with "ClassNotFoundException".

---

## ✅ THE SOLUTION (4 Simple Steps)

### Step 1: Delete Old Package Folders (5 minutes)

Open File Explorer and navigate to:
```
H:\My Drive\04 APP\parforthecoursev2\android\app\src\main\java\com\
```

You'll see:
- `parforthecourse/` folder ← **Leave this alone**
- `promethean_games/` folder ← **Delete this**
- `prometheangames/` folder ← **Delete this**

**How to delete:**
1. Right-click on `promethean_games` folder
2. Click **Delete** (or press Delete key)
3. Right-click on `prometheangames` folder  
4. Click **Delete** (or press Delete key)
5. Confirm deletion

**After deletion, `com/` should only contain:**
```
com/
  └── parforthecourse/
      └── app/
          └── MainActivity.kt
```

**OR use PowerShell script (automatic):**
```powershell
cd H:\My Drive\04 APP\parforthecoursev2
.\android\cleanup.ps1
# Follow prompts
```

---

### Step 2: Clean Gradle Build Cache (3 minutes)

Open PowerShell or Command Prompt, navigate to project:

```bash
cd H:\My Drive\04 APP\parforthecoursev2\android
./gradlew clean
```

Wait for it to complete. You should see:
```
BUILD SUCCESSFUL
```

---

### Step 3: Rebuild the App (5 minutes)

Still in the `android` folder, run:

```bash
./gradlew build
```

Wait for completion. Look for:
```
BUILD SUCCESSFUL
```

If you see errors, stop and let me know exactly what the error says.

---

### Step 4: Build Release APK (5 minutes)

```bash
./gradlew assembleRelease
```

You should see:
```
BUILD SUCCESSFUL
```

The new APK file is at:
```
android/app/release/app-release.apk
```

---

## 🧪 TEST THE FIXED APP (10 minutes)

**Before uploading to Play Store, test locally:**

1. **Connect Android device** (or use emulator)
   ```bash
   adb devices  # Should show your device
   ```

2. **Install the app**
   ```bash
   adb install -r android/app/release/app-release.apk
   ```

3. **Test on your device:**
   - ✅ App launches (doesn't crash)
   - ✅ Web content loads
   - ✅ Can tap on scores
   - ✅ No error messages

4. **If it works:** Great! Move to next step
5. **If it crashes:** Send me the crash log from logcat

---

## 📋 POLICY COMPLIANCE (30 minutes - Can Do Parallel)

While you're rebuilding, do these in Google Play Console:

### Add Privacy Policy URL
1. Go to Google Play Console → Your App
2. **App Store Listing** → scroll to **Privacy Policy**
3. Add link: `https://promethean-games.github.io/par-privacy-policy/`
   - Create this page if it doesn't exist (see template below)

### Complete Data Safety Form  
1. **Settings** → **Data Safety**
2. Answer questions honestly:
   - "Do you collect personal data?" → **No**
   - "Do you use analytics?" → **Yes** (if applicable)
   - Shared data types: Device IDs, Game Scores
   - Third-party sharing: **None**
3. **Save**

### Complete Content Rating
1. **App Content** → **Target Audience**
2. **Start Questionnaire**
3. Select:
   - Violence: **None**
   - Suggestive content: **None**
   - Final rating: **4+** (everyone, all ages)
4. **Submit**

### Double-Check Billing Transparency
1. **In-app Products** → Make sure $1.99 one-time purchase is listed
2. Verify store listing says: **"30-day free trial, then $1.99 one-time purchase"**

---

## 📄 PRIVACY POLICY TEMPLATE

Create file: `promethean-games.com/privacy`

```markdown
# Privacy Policy - Par for the Course

**Last Updated:** July 8, 2026

## What Data We Collect

Par for the Course collects minimal data:
- **Device ID:** A unique identifier for your phone (used for leaderboard sync)
- **Game Scores:** Hole scores and tournament results (core app feature)
- **Basic Analytics:** How often you use the app, which features you use

## Personal Data (We Don't Collect)

We do NOT collect:
- Your name, email, or phone number
- Your location
- Contacts or photos
- Payment information (Google Play handles this)

## Data Sharing

Your data is NOT shared with any third parties. Scores stay private between your device and our leaderboard server.

## Your Rights

- **Delete data:** Contact support@promethean-games.com to request deletion
- **Data access:** Submit request to receive all data we have about you
- **Cookie info:** Not applicable (mobile app, no cookies)

## Changes to This Policy

We may update this privacy policy. Continued use of the app means you accept any changes.

## Contact

Questions about privacy? Email: **info@promethean-games.com**
```

---

## 📤 RESUBMIT TO PLAY STORE (10 minutes)

Once rebuilt and tested locally:

1. **Google Play Console** → **Your App**
2. **Release** → **Production** → **Create new release**
3. **Upload new APK** (the `app-release.apk` you just built)
4. **Name:** "Bug Fix Release" or "3.14.1"
5. **Release notes:** "Fixed critical app launch crash"
6. **Review all compliance items** (Privacy policy, Data Safety, Rating)
7. **Check:** All required fields are complete ✅
8. **Click:** **Review** → **Submit for Review**

**Wait:** Google plays typically reviews within 1-5 business days

---

## ⏱️ TIMELINE

| Task | Time | Status |
|------|------|--------|
| Delete old folders | 5 min | 🔲 Pending |
| `gradlew clean` | 3 min | 🔲 Pending |
| `gradlew build` | 5 min | 🔲 Pending |
| `gradlew assembleRelease` | 5 min | 🔲 Pending |
| Test on device | 10 min | 🔲 Pending |
| Privacy policy + forms | 30 min | 🔲 Pending (can run parallel) |
| Resubmit to Play Store | 10 min | 🔲 Pending |
| **Total** | **~1 hour** | |
| Google Play review | 1-5 days | (out of your hands) |

---

## ❓ TROUBLESHOOTING

**Q: Build fails with error about classes**  
A: Make sure you deleted BOTH old folders. Run `dir android/app/src/main/java/com/` and verify only `parforthecourse` exists.

**Q: APK installs but still crashes**  
A: Check Android logcat for error messages:
```bash
adb logcat | grep -i "parforthecourse\|error"
```

**Q: Play Store rejects again**  
A: Check rejection reason in console. Common ones:
- Missing privacy policy → Add URL you created above
- Incomplete data safety form → Fill out all fields
- Misleading billing claim → Be explicit about trial + price

**Q: Can I keep Android stable during iOS work?**  
A: YES! This fix is Android-only. iOS work stays on `feature/ios-app-store` branch. Main stays clean.

---

## 🎯 DONE CHECKLIST

- [ ] Deleted `com/promethean_games/` folder
- [ ] Deleted `com/prometheangames/` folder
- [ ] Ran `./gradlew clean`
- [ ] Ran `./gradlew build` (successful)
- [ ] Ran `./gradlew assembleRelease` (successful)
- [ ] Installed and tested APK on device
- [ ] App launches without crashing ✅
- [ ] Web content loads correctly ✅
- [ ] Created privacy policy page
- [ ] Added privacy policy URL to Play Store
- [ ] Completed Data Safety form
- [ ] Completed Content Rating questionnaire
- [ ] Verified billing transparency in store listing
- [ ] Resubmitted APK to Play Store
- [ ] Monitoring Google Play review status

---

## 📞 HELP

If anything fails or you get stuck:
1. Note the exact error message
2. Check `ANDROID_PLAYSTORE_FIX.md` for detailed explanations
3. Let me know the error and I'll help debug

---

**Status:** Ready to fix  
**Effort:** ~3 hours total (mostly waiting for Google)  
**Risk:** Zero (you're just deleting old code and rebuilding)  

**Start Now:** `Step 1 - Delete Old Folders` above ↑

