# Par for the Course - Billiards Training Game

## Overview

Par for the Course is a mobile-first billiards training card game designed for active gameplay. The app supports local multiplayer scoring with game save/load functionality. It uses a physical card deck system (16 course cards + 2 jokers) with 3D flip animation. A Stripe paywall gates cards 4-18 (first 3 cards are free). Built with a React frontend and Express backend, all game data is stored in browser localStorage — no database required. A standalone single HTML file version is maintained for GitHub Pages deployment.

## Playtesting Mode (ACTIVE — revert before launch)

The app is currently in **playtesting mode**. All 18 holes are unlocked for testers at no cost, the Buy Now button is hidden, a first-load-per-day welcome banner is shown, and the Send Feedback button is styled green.

### To revert to paid access:
1. `client/src/lib/constants.ts` — set `PLAYTESTING_MODE = false` (or delete the constant)
2. `client/src/contexts/UnlockContext.tsx` — remove the `if (PLAYTESTING_MODE) return true;` line
3. `client/src/components/SplashScreen.tsx` — remove `PlaytestBanner` import + `<PlaytestBanner />` usage; restore feedback button to `variant="ghost" className="w-full text-sm h-10 text-muted-foreground"`
4. Delete `client/src/components/PlaytestBanner.tsx`

All PLAYTESTING_MODE touch-points are marked with `// PLAYTESTING_MODE` comments for easy search.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **State Management**: React Context API for game state (`GameContext`) and unlock state (`UnlockContext`)
- **Data Fetching**: TanStack Query for server state management
- **Build Tool**: Vite with custom Replit plugins for development

The frontend follows a screen-based navigation pattern with four main screens: Splash, Player Setup, Game, and Summary. A bottom navigation bar provides quick access during gameplay. The UI prioritizes outdoor readability with high contrast, bold typography, and one-handed operation support.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Style**: RESTful endpoints under `/api/` prefix
- **No Database**: All game data lives in browser localStorage

The server only handles two Stripe endpoints for the paywall. Development uses Vite middleware for HMR, while production serves static files from the built output.

### Data Storage
- **Local Storage**: Game sessions, settings, device IDs, and unlock status persist in browser localStorage
- **Key localStorage entries**:
  - `currentGame` - Active game session data
  - `pftc_unlocked` - Set to `"true"` after Stripe payment to unlock all 18 holes
  - `appScreen`, `appActiveTab`, `appViewOnly` - UI state persistence

### Payment & Unlock (Dual-Path)
- **Free Tier**: Holes 1-3 are always playable for free
- **Paid Unlock**: Holes 4-18 require a one-time payment
- **Persistence**: Unlock persists permanently on the device via localStorage (`pftc_unlocked = "true"`)
- **Gating**: GameScreen shows overlay for locked holes; SummaryScreen shows lock icons for holes 4-18 data

#### Stripe (Web Browser)
When running in a regular browser (not inside a TWA), the existing Stripe checkout flow is used:
1. User taps "Unlock All 18 Cards" → `POST /api/create-checkout-session`
2. Redirected to Stripe Checkout
3. On success, redirected back to `/?unlock=success&session_id={ID}`
4. App verifies payment via `GET /api/check-unlock-status?session_id=xxx`

#### Google Play Billing (TWA on Android)
When running inside a Trusted Web Activity on Android, the Digital Goods API is used:
1. `UnlockContext` detects TWA via `window.getDigitalGoodsService` availability
2. User taps "Unlock All 18 Cards" → Digital Goods API `PaymentRequest` with `https://play.google.com/billing` method
3. Native Play Billing sheet shown; user completes purchase
4. Frontend receives `purchaseToken` → sends to `POST /api/verify-play-purchase`
5. Server verifies via Google Play Developer API (`purchases.products.get`) using a Google service account
6. Server acknowledges purchase if needed, returns `{ unlocked: true }`
7. On mount, `checkPendingPurchases()` recovers any purchases that weren't verified (crash recovery)

- **Product ID (SKU)**: `full_unlock` — must be created as a managed product in Google Play Console
- **TWA detection utility**: `client/src/lib/play-billing.ts` — `isRunningInTwa()`, `initiatePlayBillingCheckout()`, `checkPendingPurchases()`
- **Digital Asset Links**: `client/public/.well-known/assetlinks.json` — contains placeholder SHA-256; replace with real fingerprint from PWABuilder before deploying (see `store-assets/store-listing.md` for step-by-step instructions)

### Game Analytics
- **Turn Timing**: Each player's turn is timed (start/end timestamps recorded in `turnTimes[]` array in GameState)
- **Accumulated Play Time**: `totalPlayTimeMs` in GameState tracks only active play time (when the game tab is visible and active). Timer pauses when switching tabs, navigating away, or when the browser tab is hidden (via `visibilitychange` API). This prevents inflated game times when saving/loading games across different days.
  - `pauseTimer()` / `resumeTimer()` methods in GameContext control the timer
  - App.tsx watches `screen`, `activeTab`, `isComplete`, and document visibility to auto-pause/resume
  - Same pause/resume logic implemented in standalone HTML
- **Analytics Component**: `GameAnalytics.tsx` renders post-game analytics in SummaryScreen using recharts:
  - Total game time and per-player time (uses `totalPlayTimeMs` when available, falls back to sum of turn times)
  - Line chart of turn durations by card (recharts)
  - Fastest/slowest card per player and group
  - Average turn time per player
  - Most consistent pace player
  - Best par-or-better streak
  - Scoring rate (strokes/minute)
- **Standalone**: Same analytics (except line chart) rendered in standalone HTML

### Anonymous Usage Analytics (PostHog)
- **Architecture**: Server-side proxy — no PostHog SDK in the browser. Events flow: `client fetch → POST /api/analytics/capture → PostHog REST API`. The PostHog API key stays server-side only; ad-blockers cannot interfere.
- **Utility**: `client/src/lib/analytics.ts` — plain fetch wrapper
  - `initAnalytics()` — no-op (kept for call-site compatibility)
  - `trackEvent(name, props?)` — POSTs to `/api/analytics/capture`; silently skipped if user opted out
  - `setAnalyticsOptOut(bool)` / `getAnalyticsOptOut()` — opt-out stored in `localStorage["pftc_analytics_opt_out"]`
- **Session ID**: Random ID generated per browser session (`sessionStorage["pftc_session_id"]`); never persistent
- **Server endpoint**: `POST /api/analytics/capture` in `server/routes.ts` — validates event name against an allowlist, rate-limited (60 req/min), forwards to `https://us.i.posthog.com/capture/`
- **Events tracked**:
  - `app_opened` — platform (`web`/`android`), app version
  - `game_started` — player_count, mode (`demo`/`full`)
  - `game_completed` — holes_played, player_count, duration_minutes (rounded to nearest 5)
  - `paywall_encountered` — hole number (fired once per GameScreen mount via `paywallTracked` ref)
  - `purchase_initiated` — checkout_type (`stripe`/`play`)
  - `purchase_completed` — checkout_type (`stripe`/`play`)
  - `tool_opened` — tool_name (`cuemaster_tools`/`coin_flip`/`cueing_emulator`/`table_leveler`)
  - `tutorial_viewed` — fired when user opens How to Play
- **Privacy**: no cookies, no IP forwarded, no PII, no third-party JS in browser
- **Opt-out**: "Help Improve the App" toggle in Settings → Display card; respects preference immediately
- **Configuration**: Set `VITE_POSTHOG_KEY` Replit secret to activate; analytics silently disabled without it
- **Policy**: Privacy Policy Section 6 updated (Mar 17, 2026) to disclose PostHog usage; opt-out key listed in Section 7

### GitHub Pages Standalone (`index.html`)
- **Root-level `index.html`**: Complete self-contained standalone game file at the project root for GitHub Pages / static hosting deployment
  - All CSS, JS, and HTML embedded inline — no build step required; works by opening in any browser
  - Card images loaded from `cards/` folder relative paths (e.g. `cards/2-01.png`, `cards/back.png`)
  - Root-level `cards/` directory is a copy of `standalone/cards/` (copy with `cp -r standalone/cards cards`)
  - Full physics engine ported to vanilla JS inside a `BP` IIFE module, matching `billiards-physics.ts` constants exactly
  - Full Cueing Emulator (canvas rendering + ball management + accordion settings + physics simulation)
  - Table Leveler, Privacy Policy, all game screens, save/load, Stripe paywall all included
  - Theme toggle (dark/light), left-handed mode, auto-save all functional
  - Stripe paywall: holes 1-3 free; holes 4-18 locked behind `https://buy.stripe.com/7sYeVc82N7czdPqaQ20Jq00`; unlock stored in `localStorage.pftc_unlocked = "true"`

### CueMaster Tools
- **Entry Point**: A single dark-green "CueMaster Tools" button (bg `#15803d`, Wrench icon, placed beneath the Buy Now button on the splash screen) opens a full-screen tool selector overlay (`CueMasterTools.tsx`). Each tool card has a gradient background and launches the tool as its own full-screen overlay. Both React and standalone versions share the same flow.
  - **Components**: `CueMasterTools.tsx` (selector overlay), `CoinFlip.tsx`, `CueingEmulator.tsx`, `CueingEmulatorTour.tsx` (interactive onboarding walkthrough — 8 steps, auto-shown on first visit, auto-advances on real actions, `localStorage: pftc_emulator_tutorial_seen`), `TableLeveler.tsx`
  - **Standalone**: `rCueMasterTools()`, `rCoinFlip()`, `rEmulator()`, `rLeveler()` render functions; `COIN` state object + `doFlip()` for the coin flip animation

- **Coin Flip**: Billiards-themed coin flip tool to decide who breaks
  - 3D CSS perspective flip animation — accumulated rotation state ensures smooth re-flips without DOM resets
  - Heads face: 8-ball design (black sphere with white circle and "8"); Tails face: cue ball (white sphere with subtle center dimple)
  - "Flip!" / "Flip Again" button; shows HEADS/TAILS result with flavor text after animation completes
  - Direct DOM manipulation (`coin-3d` element) used in standalone to trigger CSS transition without a full re-render
  - React: `CoinFlip.tsx`; Standalone: `rCoinFlip()` + `doFlip()` + `COIN` state object

- **Cueing Emulator**: Canvas-based billiards shot simulator accessible from the CueMaster Tools selector
  - Top-down 9-foot pool table rendered on HTML5 Canvas with green felt, wood rails, 6 pockets, and diamond sights
  - Ball management: add/remove solid (yellow) and stripe (white with green band) balls; drag to reposition; tap to select
  - Snap-to-grid: enabled by default, snaps dragged balls to nearest grid line (X or Y independently) with 5px buffer; diamond grid from 8×4 divisions (12.5" spacing); subtle grid lines drawn on table when active; toggle button in toolbar
  - Move Cue Ball mode: toggle button switches cue ball between aim mode (drag to set shot direction) and move mode (drag to reposition); default is aim mode
  - Undo stack: each shot pushes pre-shot state onto a history stack; Undo button pops the last state, allowing backtracking all the way to the initial layout
  - Rail width: dynamically sized to encapsulate pocket circles (pocketRadius * scale + 4px, min 16px)
  - Aiming: drag from cue ball to set direction; thin aim line extends from cue ball
  - Real-time trajectory preview: trajectories update live as aim angle, speed, english, or physics settings change
  - Trajectories terminate at pockets (no trajectory extends beyond a pocket)
  - Colored path lines per ball type (cue=light blue, solids=yellow, stripes=green); each ball involved in a collision gets its own trajectory
  - Rail bounces: trajectory lines include angles off the rail
  - Settings via accordion panels:
    - Shot Speed: slider 1–10 (maps to initial cue ball velocity)
    - Fine-Tune Angle: slider ±5° with 0.1° steps
    - English (Spin): circular cue ball face diagram with crosshairs, 0.25-tip snap grid (diagram click and sliders snap to nearest 0.25), cue tip circle overlay, and red dashed miscue limit ring (r=43.5% of ball radius, ~¾ ball width); range is -2 to +2 tips (0.25 steps); readout shows current H/V tips below diagram; H: negative = left, positive = right; V: negative = follow/topspin (top of ball), positive = draw/backspin (bottom of ball)
    - Table Physics: segmented controls for Table Speed (Slow/Medium/Fast), Equipment (Dirty/Average/Clean), Rails (Soft/Medium/Firm)
  - Cut angle display: shows cut angle in hundredths of degrees for first object ball collision, with ball-hit summary (Full/3/4/1/2/1/4 ball); fullness = 1 - sin(cutAngle)
  - Settings sidebar: slide-out panel from right side (280px), toggled by gear icon button; replaces bottom accordion for better mobile UX
  - Physics engine: `client/src/lib/billiards-physics.ts` — pure TypeScript module based on Dr. Dave Alciatore's published research (Colorado State University)
    - Ball-ball collisions: 2D elastic with throw (friction at contact point)
    - Ball-rail collisions: reflection with restitution + running/reverse English effects (spin transfer 0.15, decay 0.7)
    - Cue ball squirt: side English offsets initial direction opposite the spin side (squirt coeff 0.006)
    - Cue ball swerve: side spin component perpendicular to velocity induces gradual lateral curve (swerve coeff 0.00012)
    - Friction model (Dr. Dave-based): slip-based sliding-to-rolling transition
      - Spin tracked as 2D vector; natural roll = spin equals velocity (in ωR units)
      - Slip = spin - velocity; friction acts to reduce slip
      - Sliding phase: when |slip| > threshold, friction pushes velocity toward spin (2/7 of force) and spin toward velocity (5/7 of force) — solid sphere moment of inertia ratios
      - Rolling phase: once slip ≈ 0, only rolling friction applies (much lower deceleration)
      - Draw/backspin (positive englishY): spin opposes velocity → friction decelerates forward motion AND accelerates backward → ball reverses direction after contact
      - Follow/topspin (negative englishY): spin exceeds velocity → friction accelerates ball forward
      - Side spin: perpendicular slip component produces swerve via applySwerve function
      - Spin initialization: rollFactor = topDrawFactor * 1.5 (ensures meaningful backspin at moderate english settings)
      - Simulation stop condition: checks both velocity AND spin magnitudes (prevents premature termination when ball has spin but near-zero velocity, e.g., draw after pocketing)
    - Rolling friction (μᵣ): slow/medium/fast = 0.015/0.010/0.005 (Dr. Dave range: 0.005–0.015)
    - Sliding friction (μₛ): slow/medium/fast = 0.30/0.20/0.15 (Dr. Dave range: 0.15–0.4)
    - Rail restitution (e): soft/medium/firm = 0.55/0.72/0.85 (Dr. Dave range: 0.6–0.9+)
    - Ball-ball throw factor: dirty/average/clean = 0.050/0.035/0.020 (dirty = chalk/grime at contact, clean = polished)
    - Squirt coefficient: 0.005 (~2.5° max deflection at full english, per Dr. Dave)
    - Swerve coefficient: 0.00015 (subtle lateral curve from side spin)
  - Implemented in both React (`CueingEmulator.tsx`) and standalone HTML
- **Table Leveler**: Uses the device's motion sensors (DeviceOrientationEvent API) to display a visual bubble/spirit level
  - Circular spirit level with animated bubble that moves based on device tilt
  - Color-coded feedback: green (level) → yellow (slightly off) → red (significantly tilted)
  - Numeric L/R and F/B tilt readouts in degrees
  - Three calibration presets: Home, League, Tournament — each saved independently to localStorage
  - iOS permission handling for motion sensor access
  - Accessible from the wrench icon dropdown on the splash screen
  - localStorage keys: `pftc_level_home`, `pftc_level_league`, `pftc_level_tournament`
  - Implemented in both React (`TableLeveler.tsx`) and standalone HTML

### Key Design Decisions
1. **Offline-First Local Games**: Single-device gameplay stores all data locally, no server required
   - **Page Persistence**: App screen (splash/setup/game/summary), active tab, and view-only mode are persisted to localStorage so page refresh returns users to the last screen they were visiting
2. **Device-Based Unlock**: Stripe unlock is per-device via localStorage
3. **18-Card Limit**: Games are strictly limited to 18 cards. Frontend enforces this limit. Game auto-completes after card 18.
4. **Roster Order**: At each new card, players are re-sorted by lowest score on the previous card (tiebreak: lowest total score, then alphabetical)
5. **Card Deck System**: 16 course cards (par 2-6) + 2 joker cards. Jokers let the player choose their own par. Cards are shuffled per game.

### API Endpoints
- `POST /api/create-checkout-session` - Creates Stripe Checkout Session for unlocking all 18 holes
- `GET /api/check-unlock-status?session_id=xxx` - Verifies a Stripe checkout session payment status
- `POST /api/verify-play-purchase` - Verifies a Google Play in-app purchase token via Google Play Developer API; acknowledges the purchase if needed; returns `{ unlocked: true/false }`

### Security Hardening
- **Helmet**: Sets security HTTP headers (X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, etc.)
- **Content Security Policy (CSP)**: Environment-scoped — production removes `unsafe-inline`/`unsafe-eval` from scripts and restricts WebSocket origins; development allows them for Vite HMR
- **Rate Limiting**: `express-rate-limit` on Stripe endpoints — 10 checkout sessions / 30 status checks per 15-minute window per IP
- **Trust Proxy**: `app.set("trust proxy", 1)` ensures rate limiting uses real client IPs behind Replit's proxy
- **Input Validation**: `session_id` parameter validated against Stripe's format (`cs_test_`/`cs_live_` prefix + alphanumeric) before hitting Stripe API
- **Body Size Limits**: JSON and URL-encoded payloads capped at 16kb
- **X-Powered-By**: Disabled to avoid exposing Express fingerprint
- **Frame Ancestors**: Set to `'none'` to prevent clickjacking via iframes

### Google Play / App Store Compliance
- **Privacy Policy**: In-app Privacy Policy & Terms accessible from SplashScreen button and Settings panel "About" section; covers data collection, Stripe payment disclosure, device sensors, Google Fonts, children's privacy (COPPA), data retention/deletion
- **Data Deletion**: "Delete All App Data" button in Privacy Policy page; clears all localStorage keys (game data, settings, unlock status, calibration); auto-reloads page to prevent re-persistence from in-memory state
- **No Gambling**: App explicitly states it is not for gambling or betting; randomized card draws are for table layout selection only
- **No Ads/Analytics**: No third-party tracking, advertising identifiers, or analytics SDKs
- **No Account System**: No PII collection; player names stored locally only
- **Children's Privacy**: Compliant — no personal data collected or transmitted; suitable for all ages
- **Payment Disclosure**: Stripe payment processing disclosed; links to Stripe's privacy policy
- **Contact Info**: support@promethean-games.com and Promethean-Games.com listed in policy
- **Component**: `client/src/components/PrivacyPolicy.tsx` — full-screen overlay with print support
- **Standalone**: `rPrivacy()` function + `deleteAllAppData()` mirror the React version

### Deployment & TWA Packaging
- **Deployment Target**: Autoscale (Replit) — `npm run build` then `npm run start`
- **Production URL**: After publishing, accessible at `https://<repl-slug>.replit.app` (stable HTTPS URL required for TWA)
- **TWA Package**: Generated via [PWABuilder](https://pwabuilder.com) — produces Android App Bundle (AAB) for Google Play
- **Package Name**: `com.prometheangames.parforcourse`
- **Signing Key**: Generated by PWABuilder; SHA-256 fingerprint must be placed in `assetlinks.json` and redeployed
- **Digital Asset Links**: `/.well-known/assetlinks.json` served by explicit Express route + static middleware with `dotfiles: "allow"`
- **Store Assets**: `store-assets/` directory contains:
  - `feature-graphic.png` — 1024x500 PNG for Play Store listing
  - `store-listing.md` — short/full descriptions, content rating answers, PWABuilder step-by-step instructions, Play Console setup checklist, in-app product configuration
- **Play Billing**: Enabled in PWABuilder config; uses Digital Goods API for in-app purchases; product ID `full_unlock`

### Progressive Web App (PWA)
- **Web App Manifest**: `client/public/manifest.json` with app name, icons (72-512px), standalone display mode, portrait orientation
- **Service Worker**: `client/public/sw.js` — network-first caching strategy with offline fallback; skips `/api/` routes; auto-updates on new deployments via `skipWaiting` + `clients.claim`
- **App Icons**: Generated from favicon at 72, 96, 128, 144, 152, 192, 384, 512px sizes; 192px and 512px marked as `maskable` for adaptive icons on Android
- **iOS Support**: `apple-mobile-web-app-capable`, `black-translucent` status bar, apple-touch-icon linked, safe area insets applied via `env(safe-area-inset-*)` in CSS body
- **Android Support**: `mobile-web-app-capable`, theme-color `#16a34a` (green), background-color `#111111` (dark)
- **Open Graph**: Meta tags for social sharing (title, description, image)
- **Mobile UX**: Tap highlight disabled, callout disabled, overscroll-behavior none, viewport-fit cover for notched devices
- **Store Deployment**: App is PWA-ready for Google Play (via TWA/Trusted Web Activity) and Apple App Store (via WKWebView wrapper)

## External Dependencies

### UI Components
- **Radix UI**: Headless component primitives (dialog, dropdown, select, tabs, etc.)
- **shadcn/ui**: Pre-styled component library built on Radix
- **Lucide React**: Icon library

### Payments
- **Stripe**: Payment processing for the paywall (via `stripe` npm package)

### Development
- **Vite**: Build tool with React plugin
- **Replit Plugins**: Runtime error overlay, cartographer, and dev banner for Replit environment
- **esbuild**: Production server bundling

### Fonts
- Google Fonts CDN: Inter (sole web font; all other families were removed for PWA performance)

## Environment Variables Required
- `STRIPE_SECRET_KEY` - Stripe secret API key for creating checkout sessions
- `STRIPE_PRICE_ID` - Stripe Price ID for the "Unlock All 18 Cards" product
- `GOOGLE_SERVICE_ACCOUNT_JSON` - Full JSON key for a Google service account with `androidpublisher` scope (for verifying Play purchases server-side). Create via Google Cloud Console → IAM → Service Accounts; then link the service account in Google Play Console → Settings → API Access and grant app-level permissions for financial data and order management.
- `GOOGLE_PLAY_PACKAGE_NAME` - Android app package name (defaults to `com.prometheangames.parforcourse` if not set)
- `NODE_ENV=production` (for production builds)

## Build Commands
- `npm run dev` - Start development server (Express + Vite HMR)
- `npm run build` - Build frontend and backend
- `npm run start` - Start production server
