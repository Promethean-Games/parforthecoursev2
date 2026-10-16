# Google Play Billing Setup

This project uses a **30-day free trial + one-time purchase** model. No subscriptions, no renewals.

## How it works

1. On first app launch the server auto-creates a trial record tied to the device ID (30 days from install).
2. While the trial is active, the app is fully accessible.
3. When the trial expires, the app shows a paywall with a **one-time in-app purchase** via Google Play.
4. After a successful purchase the server verifies and acknowledges the token; access is permanent.

## 1) Play Console configuration

1. Create an **in-app product** (type: **Managed product / one-time**).  
   - Example product ID: `pftc_premium_unlock`
2. Set your price and publish it to internal/closed testing.
3. **Do not** create a subscription product for this flow.

## 2) Server environment variables

| Variable | Example | Notes |
|---|---|---|
| `GOOGLE_PLAY_PACKAGE_NAME` | `com.prometheangames.pftc.classic` | Must match your Play Console app |
| `GOOGLE_PLAY_PRODUCT_ID` | `pftc_premium_unlock` | Your managed product ID |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` | Service account with Android Publisher API access; or use `GOOGLE_APPLICATION_CREDENTIALS` |

## 3) Runtime API summary

| Endpoint | Purpose |
|---|---|
| `GET /api/billing/google-play/config` | Returns `packageName` + `productId` for the client |
| `GET /api/billing/google-play/digital-catalog` | Returns edition product IDs + bundle product ID for Digital Mode |
| `GET /api/billing/google-play/status?deviceId=...` | Checks entitlement; auto-starts 30-day trial on first call |
| `POST /api/billing/google-play/verify` | Verifies purchase token, acknowledges purchase, marks device as unlocked |

## 4) Test checklist

1. **New install** — trial starts automatically; app is fully accessible.
2. **Trial active** — status shows days remaining in trial.
3. **Trial expired** — paywall shown with "Purchase to Unlock" button.
4. **Purchase flow** — Google Play billing sheet launches; token sent to server; access granted immediately.
5. **Re-install / new device** — device needs to purchase again (purchases are device-scoped); consider adding a restore flow if needed.

## Stripe edition unlocks (Web / Digital Deck access)

Digital deck access now supports:

- Per-edition unlock: **$1.99** each
- Unlock all editions: **$4.99** one-time

### Stripe environment variables

| Variable | Required | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key used to create and verify Checkout sessions |
| `APP_BASE_URL` | Recommended | Base URL used for Checkout success/cancel redirects (falls back to request host) |
| `STRIPE_PRICE_CLASSIC` | Optional | If set, uses this Stripe Price ID instead of dynamic price data |
| `STRIPE_PRICE_RERACKED` | Optional | Same behavior |
| `STRIPE_PRICE_SEQUENTIAL` | Optional | Same behavior |
| `STRIPE_PRICE_TEED_OFF` | Optional | Same behavior |
| `STRIPE_PRICE_TOURNAMENT` | Optional | Same behavior |
| `STRIPE_PRICE_UNLOCK_ALL` | Optional | Price ID for the $4.99 unlock-all product |

### Stripe runtime API summary

| Endpoint | Purpose |
|---|---|
| `GET /api/billing/digital-entitlements?deviceId=...` | Returns edition-level unlock map for the device |
| `POST /api/billing/stripe/create-checkout-session` | Creates Checkout session for one edition or unlock-all |
| `POST /api/billing/stripe/complete-checkout` | Validates paid Checkout session and grants entitlements |

## Android WebView Billing Bridge (Digital Mode)

The Android app exposes a narrow JS bridge at `window.AndroidPlayBilling` for Digital Mode:

- `queryCatalog(requestJson)` - returns localized Google Play product metadata and pricing
- `launchPurchase(requestJson)` - launches purchase flow for one product ID
- `syncPurchases(requestJson)` - returns currently owned/pending in-app products

All callbacks are emitted as `CustomEvent("pftc-play-billing", { detail })`.
The bridge does not expose any native entitlement-granting method.

## Google Play digital product ID environment variables

Set these on the server to control product mapping without app code changes:

- `GOOGLE_PLAY_PRODUCT_CLASSIC`
- `GOOGLE_PLAY_PRODUCT_RERACKED`
- `GOOGLE_PLAY_PRODUCT_SEQUENTIAL`
- `GOOGLE_PLAY_PRODUCT_TEED_OFF`
- `GOOGLE_PLAY_PRODUCT_TOURNAMENT`
- `GOOGLE_PLAY_PRODUCT_BUNDLE_ALL` (required for the Unlock All purchase button)

## Supabase Edge Function billing (pending migration - not deployed)

Files: `supabase/migrations/20261016163811_billing_entitlements.sql`, `supabase/functions/billing/`, `supabase/config.toml`.
The Express routes above stay live until the Edge Function is deployed and the client is switched over.

### Confirmed Google Play product IDs (fixed in code, not env-configurable)

| Entitlement | Product ID |
|---|---|
| Classic | `google_play_product_classic` |
| Reracked | `google_play_product_reracked` |
| Sequential | `google_play_product_sequential` |
| Tournament | `google_play_product_tournament` |
| Tee'd Off! | `google_play_product_teedoff` |
| Digital bundle (unlock all) | `google_play_product_bundle` |

Only these six are accepted by `verify`; the bundle unlocks every edition. The older IDs
(`*.digital`, `pftc_premium_unlock`, `google_play_product_teed_off`, `google_play_product_bundle_all`) are rejected.
The `GOOGLE_PLAY_PRODUCT_*` variables are not read by the Edge Function.

### Edge Function secrets (`supabase secrets set`, never committed)

| Secret | Required | Notes |
|---|---|---|
| `GOOGLE_PLAY_PACKAGE_NAME` | Yes (no default) | Must be verified in Play Console. The function fails closed if unset. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Yes | Service-account JSON; server-side only. |
| `CORS_ALLOWED_ORIGINS` | Optional | Extra web origins; `https://appassets.androidplatform.net` is always allowed. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase.

### Purchase-token rules

- A purchase token is bound to one device at a time (`billing_purchase_tokens`).
- A purchased token presented by a different device ID moves to that device (restore); the previous device loses that grant.
- Pending or cancelled tokens never take ownership from another device.

### Local validation

From `supabase/functions/billing`, with an npm-capable Deno: `deno check index.ts index.test.ts` and
`deno test --allow-read --allow-env index.test.ts`.

## Client and native bridge: confirmed Google Play product IDs

The client (`client/src/lib/play-products.ts`) and the Android bridge
(`PlayBillingBridge.kt`) use only these six Play product IDs:
`google_play_product_classic`, `google_play_product_reracked`,
`google_play_product_sequential`, `google_play_product_tournament`,
`google_play_product_teedoff`, `google_play_product_bundle`.

- Internal edition IDs (classic, reracked, ...) are unchanged and are not Play product IDs.
- The bundle unlocks every edition; each individual product unlocks only its edition.
- The native catalog is built from this list; cached or server-supplied catalogs are ignored.
- The bridge rejects any product outside the allowlist.
- Obsolete IDs (e.g. `pftc_premium_unlock`) grant nothing.

### Server-side verification flow (implemented locally, untested against Google)

1. The bridge (`PlayBillingBridge.kt`) reports each purchase as
   `{productId, purchaseToken, state, acknowledged}` in `purchase_result` and `sync_result`
   events. Only the six allowed products are reported. Tokens are never logged.
2. `client/src/lib/play-verification.ts` sends each PURCHASED token to the Edge Function
   (`POST /google-play/verify` with `deviceId`, `productId`, `purchaseToken`) through
   `client/src/lib/billing-api.ts`, then reads `GET /digital-entitlements?deviceId=`.
   Access is granted only for editions the server confirms. Pending purchases are never
   verified or unlocked. Transient failures retry (500 ms, 1.5 s) and keep cached entitlements.
3. Restoration: every app start / entitlement refresh re-syncs Play purchases and re-verifies
   them for the current device ID, so a reinstall (new device ID) restores purchases; the
   server rebinds the token to the new device.
4. Acknowledgement: done only by the Edge Function, after Google reports PURCHASED. The bridge
   no longer acknowledges. Unverified purchases stay unacknowledged and are retried on every
   sync (Google auto-refunds unacknowledged purchases after 3 days).
5. Refunds: no refund notifications (RTDN) exist. A refund is noticed only because Play stops
   listing the purchase, which drops the local grant at the next sync. Server-side rows are
   not revoked until a token is re-verified.
6. Offline: verified entitlements stay cached in localStorage; purchase tokens are never stored.

### Required client build variables (public values; set at build time, never committed)

- `VITE_BILLING_API_URL`: the function base, e.g. `https://<project-ref>.supabase.co/functions/v1/billing`
- `VITE_SUPABASE_ANON_KEY`: the project's public anon/publishable key (not the service-role key)

If either is missing, purchases on Android fail with a clear message and no entitlement is
granted. Until these are set and the function is deployed, Android builds cannot unlock
editions. Set `GOOGLE_PLAY_PACKAGE_NAME` (server secret) only after confirming it in Play Console.

No real Google Play purchase has been tested.
