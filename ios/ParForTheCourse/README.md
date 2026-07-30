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

