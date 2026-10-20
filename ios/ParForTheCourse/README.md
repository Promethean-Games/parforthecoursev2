# ParForTheCourse iOS Scaffold

This folder contains a minimal native iOS wrapper scaffold for opening the existing web app in `WKWebView`.

## What is included

- `ParForTheCourse.xcodeproj` with one app target (`ParForTheCourse`)
- SwiftUI entry point:
  - `ParForTheCourse/ParForTheCourseApp.swift`
  - `ParForTheCourse/ContentView.swift`
- Native web wrapper and startup reliability hooks:
  - `ParForTheCourse/Web/WebViewContainer.swift`
  - `ParForTheCourse/Web/StartupDiagnostics.swift`
- App config and metadata:
  - `ParForTheCourse/Config/AppConfig.swift`
  - `ParForTheCourse/Resources/Info.plist`
  - `ParForTheCourse/Resources/PrivacyInfo.xcprivacy`
  - `ParForTheCourse/Resources/LaunchScreen.storyboard`
  - `Config/Debug.xcconfig`
  - `Config/Release.xcconfig`
  - `Config/Sandbox.xcconfig`

## Behavior notes

- Uses `APP_URL` from xcconfig, defaulting to:
  - `https://promethean-games.github.io/parforthecoursev2/`
- Implements one retry (600 ms) before fallback page.
- Injects an `AndroidScreenSecurity` bridge alias on iOS so existing `index.html` bridge calls remain unchanged.

## Open in Xcode

```bash
open ios/ParForTheCourse/ParForTheCourse.xcodeproj
```

## Next required follow-ups

1. Fill in `DEVELOPMENT_TEAM` in project settings.
2. Add real app icon image files in `Assets.xcassets/AppIcon.appiconset`.
3. Implement iOS billing bridge + StoreKit integration.
4. Replace placeholder Apple IAP verification logic in `server/billing.ts`.

## Apple Sandbox billing test configuration

Use the shared `ParForTheCourseSandbox` scheme for device testing. It keeps the hosted React app URL unchanged, enables iOS production purchase safeguards, and requires an explicit native billing endpoint so missing Sandbox configuration cannot fall back to the shared web build's billing backend.

Create `Config/Sandbox.local.xcconfig` (ignored by git) with the Sandbox project's public client configuration:

```xcconfig
IOS_BILLING_API_URL = https://YOUR-SANDBOX-PROJECT.supabase.co/functions/v1/billing
IOS_SUPABASE_ANON_KEY = YOUR_SANDBOX_SUPABASE_ANON_KEY
```

The anon key is public client configuration; never put a service-role key in the app. Leave the local file absent until the separate Sandbox project is ready. The billing function's CORS allowlist must include `https://promethean-games.github.io`.
