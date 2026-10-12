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
