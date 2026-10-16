// Google Play billing endpoints ported from server/billing.ts.
// REVIEW ONLY: not deployed. Routes (relative to /functions/v1/billing):
//   GET  /google-play/config
//   GET  /google-play/digital-catalog
//   GET  /google-play/status?deviceId=
//   POST /google-play/verify
//   GET  /digital-entitlements?deviceId=
// Stripe and Apple routes intentionally stay on the Express server.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const TRIAL_DAYS = 30;
const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const DEFAULT_ALLOWED_ORIGINS = ["https://appassets.androidplatform.net"];
const GOOGLE_FETCH_TIMEOUT_MS = 10_000;

type EditionId = "classic" | "reracked" | "sequential" | "teed-off" | "tournament";
type EntitlementMap = Record<EditionId, boolean>;

// Confirmed in Google Play Console. Intentionally constants, not env-overridable, so the
// verify allowlist cannot drift from what is actually sold. Keep in sync with
// public.billing_grant_for_product() in the migration (index.test.ts checks this).
export const EDITION_PRODUCT_IDS: Record<EditionId, string> = {
  classic: "google_play_product_classic",
  reracked: "google_play_product_reracked",
  sequential: "google_play_product_sequential",
  "teed-off": "google_play_product_teedoff",
  tournament: "google_play_product_tournament",
};
export const BUNDLE_PRODUCT_ID = "google_play_product_bundle";

export const ALLOWED_PRODUCT_IDS: ReadonlySet<string> = new Set([
  ...Object.values(EDITION_PRODUCT_IDS),
  BUNDLE_PRODUCT_ID,
]);

interface EntitlementRow {
  device_id: string;
  trial_ends_at: string | null;
  is_purchased: boolean;
  unlock_all_digital: boolean;
  edition_entitlements: unknown;
}

class ConfigError extends Error {}

const playVerifySchema = z.object({
  deviceId: z.string().min(1).max(200),
  purchaseToken: z.string().min(1).max(4096),
  packageName: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
});

const env = (name: string) => Deno.env.get(name);

const supabase = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- config ----------

// Mandatory secret: never defaulted, so a misconfigured deployment fails closed.
function getPackageName(): string {
  const packageName = env("GOOGLE_PLAY_PACKAGE_NAME")?.trim();
  if (!packageName) throw new ConfigError("GOOGLE_PLAY_PACKAGE_NAME is not configured");
  return packageName;
}

// productId in the legacy /config response is the unlock-all (bundle) product.
function getBillingConfig() {
  return { packageName: getPackageName(), productId: BUNDLE_PRODUCT_ID };
}

function getGooglePlayDigitalCatalog() {
  return {
    editionProducts: { ...EDITION_PRODUCT_IDS },
    bundleProductId: BUNDLE_PRODUCT_ID,
    logicalEntitlements: {
      edition_classic: "classic",
      edition_reracked: "reracked",
      edition_sequential: "sequential",
      edition_tournament: "tournament",
      edition_teed_off: "teed-off",
      bundle_all_editions: "all",
    },
  };
}

// ---------- entitlement formatting (unchanged contracts) ----------

function readEditionEntitlements(raw: unknown): EntitlementMap {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Partial<EntitlementMap>;
  return {
    classic: Boolean(parsed.classic),
    reracked: Boolean(parsed.reracked),
    sequential: Boolean(parsed.sequential),
    "teed-off": Boolean(parsed["teed-off"]),
    tournament: Boolean(parsed.tournament),
  };
}

function formatDigitalEntitlementsResponse(row: EntitlementRow) {
  const entitlements = row.unlock_all_digital
    ? { classic: true, reracked: true, sequential: true, "teed-off": true, tournament: true }
    : readEditionEntitlements(row.edition_entitlements);
  return { unlockAll: row.unlock_all_digital, entitlements };
}

function formatAccessResponse(row: EntitlementRow) {
  const now = Date.now();
  const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const trialActive = Boolean(trialEndsAt && trialEndsAt.getTime() > now);
  const hasAccess = row.is_purchased || trialActive;

  let daysLeftInTrial: number | null = null;
  if (trialActive && trialEndsAt) {
    daysLeftInTrial = Math.ceil((trialEndsAt.getTime() - now) / (1000 * 60 * 60 * 24));
  }

  let message: string;
  if (row.is_purchased) {
    message = "Unlocked — enjoy Par for the Course!";
  } else if (trialActive) {
    message = `Free trial active — ${daysLeftInTrial} day${daysLeftInTrial === 1 ? "" : "s"} remaining.`;
  } else {
    message = "Your 30-day free trial has ended. Purchase once to unlock the app.";
  }

  return {
    hasAccess,
    isPurchased: row.is_purchased,
    trialActive,
    trialEndsAt: trialEndsAt?.toISOString() || null,
    daysLeftInTrial,
    message,
    checkedAt: new Date().toISOString(),
  };
}

// ---------- database (RPCs defined in the migration) ----------

function firstRow<T>(data: T | T[] | null): T {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Database returned no row");
  return row;
}

async function getOrCreateEntitlement(deviceId: string): Promise<EntitlementRow> {
  const { data, error } = await supabase.rpc("billing_get_or_create_entitlement", {
    p_device_id: deviceId,
    p_trial_days: TRIAL_DAYS,
  });
  if (error) throw error;
  return firstRow<EntitlementRow>(data);
}

// ---------- Google Play API (WebCrypto replacement for google-auth-library) ----------

const encoder = new TextEncoder();

function base64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const raw = env("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new ConfigError("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured");

  let credentials: { client_email?: string; private_key?: string; token_uri?: string };
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new ConfigError("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new ConfigError("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is missing client_email or private_key");
  }

  const tokenUri = credentials.token_uri || "https://oauth2.googleapis.com/token";
  const iat = Math.floor(Date.now() / 1000);
  const claims = {
    iss: credentials.client_email,
    scope: ANDROID_PUBLISHER_SCOPE,
    aud: tokenUri,
    iat,
    exp: iat + 3600,
  };
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(signature)}`,
    }),
    signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status})`);
  }
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Could not retrieve Google Play access token");

  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

function playTokenUrl(packageName: string, productId: string, purchaseToken: string): string {
  return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName,
  )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
}

async function fetchPlayProductPurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<Record<string, unknown>> {
  const accessToken = await getAccessToken();
  const response = await fetch(playTokenUrl(packageName, productId, purchaseToken), {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    // Body is logged by the caller only as a status; it can echo request details.
    throw new Error(`Play verification failed (${response.status})`);
  }
  return await response.json() as Record<string, unknown>;
}

async function acknowledgePurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<void> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${playTokenUrl(packageName, productId, purchaseToken)}:acknowledge`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    // The legacy server ignored this result; surface it in logs without failing verification.
    console.warn(`Play acknowledge returned ${response.status}`);
  }
}

// ---------- HTTP ----------

function allowedOrigins(): Set<string> {
  const configured = (env("CORS_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !allowedOrigins().has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    if (!origin || Object.keys(cors).length > 0) {
      return new Response(null, { status: 204, headers: cors });
    }
    return json({ error: "Origin not allowed" }, 403, {});
  }

  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*?\/billing(?=\/|$)/, "").replace(/\/+$/, "");
  const deviceId = url.searchParams.get("deviceId") ?? "";

  try {
    if (req.method === "GET" && route === "/google-play/config") {
      try {
        const config = getBillingConfig();
        return json({ packageName: config.packageName, productId: config.productId }, 200, cors);
      } catch (error) {
        console.error("Billing configuration error:", error instanceof Error ? error.message : error);
        return json({ error: "Billing is not configured" }, 500, cors);
      }
    }

    if (req.method === "GET" && route === "/google-play/digital-catalog") {
      return json(getGooglePlayDigitalCatalog(), 200, cors);
    }

    if (req.method === "GET" && route === "/google-play/status") {
      if (!deviceId) return json({ error: "deviceId is required" }, 400, cors);
      try {
        return json(formatAccessResponse(await getOrCreateEntitlement(deviceId)), 200, cors);
      } catch (error) {
        console.error("Error checking billing status:", error);
        return json({ error: "Failed to check purchase status" }, 500, cors);
      }
    }

    if (req.method === "GET" && route === "/digital-entitlements") {
      if (!deviceId) return json({ error: "deviceId is required" }, 400, cors);
      try {
        return json(formatDigitalEntitlementsResponse(await getOrCreateEntitlement(deviceId)), 200, cors);
      } catch (error) {
        console.error("Error getting digital entitlements:", error);
        return json({ error: "Failed to get digital entitlements" }, 500, cors);
      }
    }

    if (req.method === "POST" && route === "/google-play/verify") {
      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        return json({ error: "Invalid request" }, 400, cors);
      }
      const parsed = playVerifySchema.safeParse(payload);
      if (!parsed.success) {
        return json({ error: parsed.error.errors[0]?.message || "Invalid request" }, 400, cors);
      }

      try {
        const packageName = getPackageName();
        const productId = parsed.data.productId || BUNDLE_PRODUCT_ID;

        // Reject before calling Google: only the configured app and the six confirmed products.
        if (parsed.data.packageName && parsed.data.packageName !== packageName) {
          return json({ error: "Unsupported packageName" }, 400, cors);
        }
        if (!ALLOWED_PRODUCT_IDS.has(productId)) {
          return json({ error: "Unsupported productId" }, 400, cors);
        }

        const { deviceId: verifyDeviceId, purchaseToken } = parsed.data;
        const playPayload = await fetchPlayProductPurchase(packageName, productId, purchaseToken);

        // purchaseState: 0=Purchased, 1=Cancelled, 2=Pending
        const purchaseState = typeof playPayload.purchaseState === "number" ? playPayload.purchaseState : -1;

        if (purchaseState === 0) {
          const acknowledgeState = typeof playPayload.acknowledgeState === "number" ? playPayload.acknowledgeState : 1;
          if (acknowledgeState === 0) {
            await acknowledgePurchase(packageName, productId, purchaseToken).catch((err) =>
              console.warn("Failed to acknowledge purchase:", err instanceof Error ? err.message : err)
            );
          }
        }

        const { data, error } = await supabase.rpc("billing_record_play_verification", {
          p_device_id: verifyDeviceId,
          p_purchase_token: purchaseToken,
          p_product_id: productId,
          p_package_name: packageName,
          p_purchase_state: purchaseState,
          p_play_payload: playPayload,
          p_trial_days: TRIAL_DAYS,
        });
        if (error) throw error;

        return json(formatAccessResponse(firstRow<EntitlementRow>(data)), 200, cors);
      } catch (error) {
        console.error("Error verifying Google Play purchase:", error instanceof Error ? error.message : error);
        return json({ error: "Failed to verify Google Play purchase" }, 500, cors);
      }
    }

    return json({ error: "Not found" }, 404, cors);
  } catch (error) {
    console.error("Unhandled billing error:", error);
    return json({ error: "Internal Server Error" }, 500, cors);
  }
}

Deno.serve(handler);
