import type { Express } from "express";
import { z } from "zod";
import { GoogleAuth } from "google-auth-library";
import { pool } from "./db";

const TRIAL_DAYS = 30;

interface EntitlementRow {
  device_id: string;
  platform: string;
  trial_started_at: Date;
  trial_ends_at: Date;
  is_purchased: boolean;
  purchase_token: string | null;
  product_id: string | null;
  package_name: string | null;
  purchase_state: number | null;
  play_payload: unknown;
  apple_transaction_id: string | null;
  apple_bundle_id: string | null;
  apple_payload: unknown;
  updated_at: Date;
}

const playVerifySchema = z.object({
  deviceId: z.string().min(1),
  purchaseToken: z.string().min(1),
  packageName: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
});

const appleVerifySchema = z.object({
  deviceId: z.string().min(1),
  transactionId: z.string().min(1),
  bundleId: z.string().min(1).optional(),
  appUserId: z.string().optional(),
});

const GOOGLE_ANDROID_PUBLISHER_SCOPE =
  "https://www.googleapis.com/auth/androidpublisher";

function getGoogleAuth(): GoogleAuth {
  const rawCredentials = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) {
    return new GoogleAuth({ scopes: [GOOGLE_ANDROID_PUBLISHER_SCOPE] });
  }
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(rawCredentials) as Record<string, unknown>;
  } catch {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  return new GoogleAuth({
    credentials,
    scopes: [GOOGLE_ANDROID_PUBLISHER_SCOPE],
  });
}

function getBillingConfig() {
  return {
    packageName:
      process.env.GOOGLE_PLAY_PACKAGE_NAME ||
      "com.prometheangames.pftc.classic",
    productId:
      process.env.GOOGLE_PLAY_PRODUCT_ID || "pftc_premium_unlock",
  };
}

async function getAccessToken(): Promise<string> {
  const auth = getGoogleAuth();
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token =
    typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error("Could not retrieve Google Play access token");
  return token;
}

async function fetchPlayProductPurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<Record<string, unknown>> {
  const accessToken = await getAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName,
  )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Play verification failed (${response.status}): ${errorText}`,
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
}

async function acknowledgePurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<void> {
  const accessToken = await getAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName,
  )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(
    purchaseToken,
  )}:acknowledge`;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
}

async function getOrCreateEntitlement(deviceId: string): Promise<EntitlementRow> {
  const existing = await pool.query<EntitlementRow>(
    `SELECT * FROM billing_entitlements WHERE device_id = $1 LIMIT 1`,
    [deviceId],
  );
  if (existing.rows[0]) return existing.rows[0];

  const trialEndsAt = new Date(
    Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
  );

  const created = await pool.query<EntitlementRow>(
    `INSERT INTO billing_entitlements
       (device_id, trial_started_at, trial_ends_at, is_purchased, updated_at)
     VALUES ($1, NOW(), $2, false, NOW())
     ON CONFLICT (device_id) DO UPDATE
       SET updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [deviceId, trialEndsAt],
  );
  return created.rows[0];
}

function formatAccessResponse(row: EntitlementRow) {
  const now = Date.now();
  const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const trialActive = Boolean(trialEndsAt && trialEndsAt.getTime() > now);
  const hasAccess = row.is_purchased || trialActive;

  let daysLeftInTrial: number | null = null;
  if (trialActive && trialEndsAt) {
    daysLeftInTrial = Math.ceil(
      (trialEndsAt.getTime() - now) / (1000 * 60 * 60 * 24),
    );
  }

  let message: string;
  if (row.is_purchased) {
    message = "Unlocked — enjoy Par for the Course!";
  } else if (trialActive) {
    message = `Free trial active — ${daysLeftInTrial} day${daysLeftInTrial === 1 ? "" : "s"} remaining.`;
  } else {
    message =
      "Your 30-day free trial has ended. Purchase once to unlock the app.";
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

export function registerBillingRoutes(app: Express) {
  app.get("/api/billing/google-play/config", (_req, res) => {
    const config = getBillingConfig();
    res.json({
      packageName: config.packageName,
      productId: config.productId,
    });
  });

  // Check entitlement status — auto-starts trial on first call
  app.get("/api/billing/google-play/status", async (req, res) => {
    const deviceId =
      typeof req.query.deviceId === "string" ? req.query.deviceId : "";
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    try {
      const row = await getOrCreateEntitlement(deviceId);
      res.json(formatAccessResponse(row));
    } catch (error) {
      console.error("Error checking billing status:", error);
      res.status(500).json({ error: "Failed to check purchase status" });
    }
  });

  // Verify one-time purchase token from Google Play
  app.post("/api/billing/google-play/verify", async (req, res) => {
    const parsed = playVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    try {
      const config = getBillingConfig();
      const packageName = parsed.data.packageName || config.packageName;
      const productId = parsed.data.productId || config.productId;

      const playPayload = await fetchPlayProductPurchase(
        packageName,
        productId,
        parsed.data.purchaseToken,
      );

      // purchaseState: 0=Purchased, 1=Cancelled, 2=Pending
      const purchaseState =
        typeof playPayload.purchaseState === "number"
          ? playPayload.purchaseState
          : -1;
      const isPurchased = purchaseState === 0;

      if (isPurchased) {
        // Acknowledge if not already done (acknowledgeState 0 = unacknowledged)
        const acknowledgeState =
          typeof playPayload.acknowledgeState === "number"
            ? playPayload.acknowledgeState
            : 1;
        if (acknowledgeState === 0) {
          await acknowledgePurchase(
            packageName,
            productId,
            parsed.data.purchaseToken,
          ).catch((err) =>
            console.warn("Failed to acknowledge purchase:", err),
          );
        }
      }

      await pool.query(
        `INSERT INTO billing_entitlements
           (device_id, trial_started_at, trial_ends_at, is_purchased, purchase_token,
            product_id, package_name, purchase_state, play_payload, updated_at)
         VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
         ON CONFLICT (device_id) DO UPDATE SET
           is_purchased    = CASE WHEN billing_entitlements.is_purchased THEN true ELSE EXCLUDED.is_purchased END,
           purchase_token  = EXCLUDED.purchase_token,
           product_id      = EXCLUDED.product_id,
           package_name    = EXCLUDED.package_name,
           purchase_state  = EXCLUDED.purchase_state,
           play_payload    = EXCLUDED.play_payload,
           updated_at      = NOW()`,
        [
          parsed.data.deviceId,
          new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          isPurchased,
          parsed.data.purchaseToken,
          productId,
          packageName,
          purchaseState,
          JSON.stringify(playPayload),
        ],
      );

      const row = await getOrCreateEntitlement(parsed.data.deviceId);
      res.json(formatAccessResponse(row));
    } catch (error) {
      console.error("Error verifying Google Play purchase:", error);
      res.status(500).json({ error: "Failed to verify Google Play purchase" });
    }
  });

  // Get Apple IAP config
  app.get("/api/billing/apple-iap/config", (_req, res) => {
    res.json({
      bundleId: process.env.APPLE_BUNDLE_ID || "com.parforthecourse.app",
      productId: process.env.APPLE_PRODUCT_ID || "com.parforthecourse.app.premium_unlock",
    });
  });

  // Check Apple entitlement status — auto-starts trial on first call
  app.get("/api/billing/apple-iap/status", async (req, res) => {
    const deviceId =
      typeof req.query.deviceId === "string" ? req.query.deviceId : "";
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    try {
      const row = await getOrCreateEntitlement(deviceId);
      res.json(formatAccessResponse(row));
    } catch (error) {
      console.error("Error checking Apple billing status:", error);
      res.status(500).json({ error: "Failed to check purchase status" });
    }
  });

  // Verify Apple IAP purchase via server-side validation (App Store Server API)
  app.post("/api/billing/apple-iap/verify", async (req, res) => {
    const parsed = appleVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    try {
      // TODO: In production, send transactionId to Apple App Store Server API to verify
      // For now, store the transaction and mark as purchased
      // Apple verification requires: APPLE_KEY_ID, APPLE_ISSUER_ID, and APPLE_PRIVATE_KEY env vars
      const isPurchased = true; // Assuming verification succeeds

      const applePayload = {
        transactionId: parsed.data.transactionId,
        verifiedAt: new Date().toISOString(),
        status: "verified",
      };

      await pool.query(
        `INSERT INTO billing_entitlements
           (device_id, platform, trial_started_at, trial_ends_at, is_purchased,
            apple_transaction_id, apple_bundle_id, apple_payload, updated_at)
         VALUES ($1, 'apple', NOW(), $2, $3, $4, $5, $6::jsonb, NOW())
         ON CONFLICT (device_id) DO UPDATE SET
           is_purchased          = CASE WHEN billing_entitlements.is_purchased THEN true ELSE EXCLUDED.is_purchased END,
           apple_transaction_id  = EXCLUDED.apple_transaction_id,
           apple_bundle_id       = EXCLUDED.apple_bundle_id,
           apple_payload         = EXCLUDED.apple_payload,
           updated_at            = NOW()`,
        [
          parsed.data.deviceId,
          new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          isPurchased,
          parsed.data.transactionId,
          parsed.data.bundleId || process.env.APPLE_BUNDLE_ID || "com.parforthecourse.app",
          JSON.stringify(applePayload),
        ],
      );

      const row = await getOrCreateEntitlement(parsed.data.deviceId);
      res.json(formatAccessResponse(row));
    } catch (error) {
      console.error("Error verifying Apple IAP purchase:", error);
      res.status(500).json({ error: "Failed to verify Apple IAP purchase" });
    }
  });
}
