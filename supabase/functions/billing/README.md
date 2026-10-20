# Billing Edge Function

Apple transaction verification uses Apple's `@apple/app-store-server-library` and its `SignedDataVerifier` with online certificate revocation checks.

Configure these values in the Edge Function environment before enabling production verification:

- `APPLE_ROOT_CA_CERTIFICATES`: JSON array of base64-encoded DER Apple root CA certificates used as trust anchors. Obtain the certificates from Apple's official PKI site.
- `APPLE_ALLOWED_ENVIRONMENT`: exactly `Sandbox` for a non-production project or `Production` for the production project. The endpoint does not accept an environment choice from the client.
- `APPLE_APP_ID`: numeric App Store app ID. Required for Production verification; not required by Apple's verifier for Sandbox.

The server-side `SUPABASE_SERVICE_ROLE_KEY` remains server-only. The Apple verifier does not require an App Store private key.

Apple App Store Server Notifications are handled by the separate `apple-notifications` Edge Function. Its Supabase JWT check is disabled because Apple cannot send a Supabase JWT; it accepts only signed payloads that pass Apple's verifier and uses the restricted `billing_record_apple_revocation` RPC. Configure separate Sandbox and Production notification URLs/projects so each project has the matching `APPLE_ALLOWED_ENVIRONMENT`. The append-only notification-ordering migration tracks Apple's signed notification date and ignores duplicates or older state changes.

The hosted React app needs `VITE_BILLING_API_URL` and the public `VITE_SUPABASE_ANON_KEY` in the GitHub Pages build environment. Configure the billing function's `CORS_ALLOWED_ORIGINS` to include the exact app origin (`https://promethean-games.github.io`). These are client configuration values; never place a service-role key or Apple private key in the web build.

The focused verifier unit tests can be run with `deno test --allow-env --allow-read apple-verification.test.ts` from this directory. They mock Apple's verifier to test validation and RPC gating; a smoke test also checks that the library imports in Deno. They do not test a real Apple certificate chain. Database idempotency, revocation, and SQL behavior require the separate `supabase/tests/apple_billing.test.sql` integration test, which requires a local Supabase database and has not been run.
