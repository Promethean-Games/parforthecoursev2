# iOS Readiness Report (Audit)

Date: 2026-07-30
Repository: `parforthecoursev2`

## 1) Readiness Score

**Current iOS readiness: 52%**

Scoring basis (weighted):
- Architecture clarity and platform separation: 20/20
- Existing iOS native project structure: 14/25
- Native integration parity (billing, bridge, startup): 6/20
- App Store technical compliance artifacts: 4/15
- Asset completeness for iOS: 2/10
- Build/validation evidence (Xcode/Pods): 4/10

## 2) Blocking Issues (must fix before Xcode build/distribution)

1. **iOS scaffold now exists but is not yet validated on macOS/Xcode**
   - Added scaffold under `ios/ParForTheCourse/` including `.xcodeproj`, app target files, Swift sources, `Info.plist`, `Assets.xcassets`, and shared scheme.
   - Still requires open/build validation in Xcode on macOS (`xcodebuild` unavailable in this environment).

2. **No iOS equivalent to Android startup wrapper**
   - Android startup logic is implemented in `android/app/src/main/java/com/parforthecourse/app/MainActivity.kt` and `android/app/src/main/java/com/parforthecourse/app/StartupDiagnostics.kt`.
   - No WKWebView implementation exists yet in tracked source.

3. **iOS purchase verification is placeholder logic on backend**
   - `server/billing.ts` has TODO and currently assumes success for Apple verification (`isPurchased = true`).
   - This is not production-grade App Store verification behavior.

4. **No iOS app metadata files to satisfy App Store build validation**
   - No `Info.plist` usage descriptions, ATS policy, or iOS build number/version setup in project files.

## 3) Warnings / Non-blocking Gaps

- `package.json` includes `react-onesignal`, but no usage in `client/src`.
- `npm run check` cannot be validated in this environment (tooling/dependency state issue reported by `tsc`: "The system cannot find the path specified.").
- Existing docs (`iOS_SETUP.md`, `iOS_CHECKLIST.md`, `ios/DEVELOPMENT.md`) are plans, not compiled assets.

## 4) Architecture Audit

### Observed architecture

- **Android shell (native)**: WebView host app in `android/`.
- **Primary shipped web app (frontend-only)**: root `index.html` + `cards/` (GitHub Pages static).
- **Secondary web app stack (React + Express)**: `client/` + `server/` + `shared/`.
- `_config.yml` excludes `client/`, `server/`, `shared/` from GitHub Pages output.

### Platform-specific Android code

- Native Android startup/runtime:
  - `android/app/src/main/java/com/parforthecourse/app/MainActivity.kt`
  - `android/app/src/main/java/com/parforthecourse/app/StartupDiagnostics.kt`
- Android app packaging/config:
  - `android/app/build.gradle.kts`
  - `android/app/src/main/AndroidManifest.xml`
  - `android/app/src/main/res/**`

### Platform-agnostic logic

- Core gameplay and UI logic (currently static deployment path): `index.html`.
- Web React app logic: `client/src/**`.
- Server business logic/APIs: `server/**`.
- Shared schema/types: `shared/schema.ts`.

### Recommended abstractions (minimal, no redesign)

1. Define a **single native bridge contract** for both platforms:
   - `setCardVisibility`/`setCardsVisible` parity (Android currently, iOS missing).
   - Purchase status requests and callbacks.
2. Define one **startup state contract** (`loading`, `retrying`, `fallback`, diagnostics payload) mirrored in Android and iOS wrappers.
3. Keep game logic where it is; only wrap platform services (billing, secure screen, wake lock).

## 5) Framework Compatibility Check (React Native / Expo)

- This repository is **not React Native** and **not Expo**.
- Evidence:
  - No `react-native` dependency.
  - No `expo` dependency.
  - No `app.json`, `app.config.*`, `metro.config.*`, or `babel.config.*`.
  - Android app is native Kotlin + WebView wrapper.

### iOS support status

- **Current support: documentation-only.**
- Missing for actual iOS support:
  - Xcode project scaffold and target files.
  - WKWebView runtime implementation.
  - Native billing (StoreKit) implementation.
  - iOS signing/build settings tracked in project.

## 6) Dependency Audit

Legend:
- `iOS Web`: works in Safari/WKWebView context.
- `Server`: backend-only, not part of iOS app binary.
- `Android Native`: Android-only.
- `Action`: keep / remove / replace.

### Runtime dependencies (`package.json`) and iOS impact

- `@hookform/resolvers` - iOS Web - keep
- `@jridgewell/trace-mapping` - build/runtime utility - keep
- `@neondatabase/serverless` - Server - keep
- `@radix-ui/react-accordion` - iOS Web - keep
- `@radix-ui/react-alert-dialog` - iOS Web - keep
- `@radix-ui/react-aspect-ratio` - iOS Web - keep
- `@radix-ui/react-avatar` - iOS Web - keep
- `@radix-ui/react-checkbox` - iOS Web - keep
- `@radix-ui/react-collapsible` - iOS Web - keep
- `@radix-ui/react-context-menu` - iOS Web - keep
- `@radix-ui/react-dialog` - iOS Web - keep
- `@radix-ui/react-dropdown-menu` - iOS Web - keep
- `@radix-ui/react-hover-card` - iOS Web - keep
- `@radix-ui/react-label` - iOS Web - keep
- `@radix-ui/react-menubar` - iOS Web - keep
- `@radix-ui/react-navigation-menu` - iOS Web - keep
- `@radix-ui/react-popover` - iOS Web - keep
- `@radix-ui/react-progress` - iOS Web - keep
- `@radix-ui/react-radio-group` - iOS Web - keep
- `@radix-ui/react-scroll-area` - iOS Web - keep
- `@radix-ui/react-select` - iOS Web - keep
- `@radix-ui/react-separator` - iOS Web - keep
- `@radix-ui/react-slider` - iOS Web - keep
- `@radix-ui/react-slot` - iOS Web - keep
- `@radix-ui/react-switch` - iOS Web - keep
- `@radix-ui/react-tabs` - iOS Web - keep
- `@radix-ui/react-toast` - iOS Web - keep
- `@radix-ui/react-toggle` - iOS Web - keep
- `@radix-ui/react-toggle-group` - iOS Web - keep
- `@radix-ui/react-tooltip` - iOS Web - keep
- `@tanstack/react-query` - iOS Web - keep
- `@types/bcrypt` - typing only - keep
- `@types/web-push` - typing only - keep
- `bcrypt` - Server - keep
- `class-variance-authority` - iOS Web - keep
- `clsx` - iOS Web - keep
- `cmdk` - iOS Web - keep
- `connect-pg-simple` - Server - keep
- `date-fns` - iOS Web - keep
- `drizzle-orm` - Server - keep
- `drizzle-zod` - shared/server - keep
- `embla-carousel-react` - iOS Web - keep
- `express` - Server - keep
- `express-rate-limit` - Server - keep
- `express-session` - Server - keep
- `framer-motion` - iOS Web - keep
- `google-auth-library` - Server (Play verification) - keep
- `helmet` - Server - keep
- `input-otp` - iOS Web - keep
- `lucide-react` - iOS Web - keep
- `memorystore` - Server - keep
- `next-themes` - iOS Web - keep
- `passport` - Server (currently little/no active auth flow in routes) - keep
- `passport-local` - Server - keep
- `react` - iOS Web - keep
- `react-day-picker` - iOS Web - keep
- `react-dom` - iOS Web - keep
- `react-hook-form` - iOS Web - keep
- `react-icons` - iOS Web - keep
- `react-onesignal` - iOS Web dependency but unused - optional cleanup candidate
- `react-resizable-panels` - iOS Web - keep
- `recharts` - iOS Web - keep
- `stripe` - Server integration/lib - keep
- `tailwind-merge` - iOS Web - keep
- `tailwindcss-animate` - iOS Web - keep
- `tw-animate-css` - iOS Web - keep
- `vaul` - iOS Web - keep
- `web-push` - Server - keep
- `wouter` - iOS Web - keep
- `ws` - Server - keep
- `zod` - iOS Web + Server/shared - keep
- `zod-validation-error` - Server/shared - keep

### Dev dependencies (`package.json`)

- Tooling/build deps only (`vite`, `typescript`, `tsx`, `drizzle-kit`, Tailwind, plugins, types).
- No iOS-native blocker identified here.

### Optional dependencies (`package.json`)

- `bufferutil` - optional perf dep for WebSocket stack - no iOS native impact.

### Android-native dependencies (`android/app/build.gradle.kts`)

- `androidx.appcompat:appcompat`
- `androidx.core:core`
- `androidx.lifecycle:lifecycle-runtime-ktx`
- `androidx.activity:activity-compose`
- `androidx.compose:*`
- Test deps: JUnit / Espresso / Compose test

These are **Android-only** and expected.

### Android-only library behavior that affects iOS

- Web billing flow uses Play Digital Goods APIs in `client/src/lib/googlePlayBilling.ts`:
  - `PaymentRequest` with `https://play.google.com/billing`
  - `window.getDigitalGoodsService`
- This path is not available on iOS and must be platform-switched to StoreKit via native bridge.

## 7) Native Integration Review

- **Authentication**
  - No full user auth flow is active in current app routes; director PIN is used in tournament routes.
  - iOS impact: none for base app compile.

- **Storage**
  - Web uses `localStorage` for device and UI state (`client/src/contexts/TournamentContext.tsx`, `client/src/lib/billingDevice.ts`).
  - iOS impact: works in WKWebView local storage sandbox; no migration needed for first build.

- **Notifications**
  - No active client notification integration found; `react-onesignal` present but unused.
  - iOS impact: no immediate blocker.

- **Deep linking**
  - Android has launcher intent only; no app links.
  - iOS equivalent URL scheme/universal links not implemented.

- **Camera**
  - No camera API usage found.

- **File access**
  - Web backup export uses browser `Blob` + anchor download in `client/src/components/TournamentManagementPage.tsx`.
  - WKWebView download UX may differ by iOS version; functional review needed.

- **Networking**
  - Relative `/api/*` usage in React app; hosted origin must expose matching backend routes.
  - Android wrapper points to static GitHub Pages URL via `BuildConfig.APP_URL`.

- **Billing / IAP**
  - Android/Play flow implemented in web layer + backend verification.
  - Apple endpoints exist but server-side verification is placeholder (`server/billing.ts`).
  - iOS native purchase flow is not yet implemented.

- **Bluetooth**
  - No Bluetooth usage found.

- **Permissions**
  - Android manifest includes only `INTERNET` and `ACCESS_NETWORK_STATE`.
  - iOS permissions keys cannot be audited yet because no `Info.plist` exists.

## 8) Configuration File Audit

- `package.json`: present and valid for current web/server build.
- `app.json` / `app.config.*`: **missing** (expected for non-Expo project).
- `metro.config.*`: **missing** (expected for non-React-Native project).
- `babel.config.*`: **missing** (not required by current Vite setup).
- Gradle files: present and coherent for Android (`android/app/build.gradle.kts`).
- Environment handling:
  - Server uses `process.env.*` in `server/billing.ts`, `server/db.ts`, `server/app.ts`, `drizzle.config.ts`.
  - No iOS xcconfig/env wiring in repo yet.

## 9) iOS Project Generation / CocoaPods

### Current state

- No iOS project files exist to build.
- No `Podfile` or `Podfile.lock` present.
- No SPM package manifests for iOS target in repo.

### Validation limits in this environment

- `xcodebuild` not available here.
- `pod` (CocoaPods) not available here.
- `xcodegen` not available here.

Result: actual generation/compilation cannot be executed from this machine snapshot.

### Pod dependency expectations

- For a minimal WKWebView wrapper + StoreKit 2 approach, **Pods are not strictly required**.
- CocoaPods compatibility risk is currently low because no Pod integrations exist yet.

## 10) Assets Audit

- Android assets exist (`android/app/src/main/res/mipmap-anydpi-v26/*`, `drawable/*`).
- Web favicon exists (`client/public/favicon.png`).
- `store-assets/` is currently empty.
- No iOS `Assets.xcassets` found.

Missing for iOS submission readiness:
- App icons for all required iPhone sizes.
- Launch/splash assets in iOS asset catalog.
- Retina-specific image sets (`@2x`, `@3x`) where needed.
- Safe-area verification in actual SwiftUI/WKWebView container.

## 11) App Store Requirements Audit

- **Bundle Identifier**: planned as `com.parforthecourse.app` in docs and Android config.
- **Version/build numbers**: no iOS build settings committed yet.
- **Privacy manifest**: none present (`PrivacyInfo.xcprivacy` missing).
- **Info.plist usage descriptions**: cannot validate (file missing).
- **ATS policy**: cannot validate (file missing).
- **Required keys**: cannot validate until iOS project exists.

## 12) Android Assumptions Found

1. Android JS bridge usage in static app:
   - `index.html` calls `window.AndroidScreenSecurity` methods.
   - iOS equivalent bridge is absent.

2. Google Play billing APIs are Android-specific:
   - `client/src/lib/googlePlayBilling.ts` depends on Play billing methods not present on iOS.

3. Startup/fallback behavior depends on Android WebView implementation:
   - Retry/fallback/diagnostics are in `MainActivity.kt` and `StartupDiagnostics.kt` only.

No direct hardcoded Android filesystem paths or Intent APIs were found in `client/src`.

## 13) Startup Reliability Parity (Android vs iOS)

Current Android reliability strengths:
- Network status checks and diagnostic state.
- One-time retry before fallback.
- Main-frame HTTP/web errors captured.
- Fallback UI with retry and optional diagnostics.

Required iOS parity tasks (no redesign):
1. Mirror the same state machine in WKWebView navigation delegate.
2. Implement one retry with delay before fallback page.
3. Emit structured diagnostics (step, error, HTTP status if available, network state).
4. Implement same card-protection bridge contract as Android.
5. Ensure app URL and version are emitted consistently for support/debug logs.

## 14) Estimated Effort Remaining

- **iOS scaffold and buildable project:** 2-3 days
- **WKWebView wrapper + bridge parity:** 3-5 days
- **StoreKit 2 purchase flow + backend verification hardening:** 5-8 days
- **Assets and App Store metadata packaging:** 2-4 days
- **TestFlight QA and issue pass:** 5-8 days

**Total estimate:** ~3 to 5 weeks (single engineer), depending on App Store review turnaround and billing verification hardening.

## 15) Recommended Next Actions (ordered)

1. Create and commit the iOS Xcode project scaffold under `ios/` (no feature redesign).
2. Implement WKWebView startup parity with Android (`MainActivity.kt` behavior contract).
3. Implement iOS-native billing bridge and replace Play-only purchase path on iOS runtime.
4. Replace placeholder Apple verification logic in `server/billing.ts` with real App Store Server API validation.
5. Add iOS assets, `Info.plist` keys, ATS policy, and privacy manifest; then run TestFlight checks.


