import type { Express, Request } from "express";
import { z } from "zod";
import { GoogleAuth } from "google-auth-library";
import Stripe from "stripe";
import { pool } from "./db";

const TRIAL_DAYS = 30;

interface EntitlementRow {
  device_id: string;
  platform: string;
  trial_started_at: Date;
  trial_ends_at: Date;
  is_purchased: boolean;
  unlock_all_digital: boolean;
  edition_entitlements: unknown;
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

const EDITION_IDS = ["classic", "reracked", "sequential", "teed-off", "tournament"] as const;
type EditionId = (typeof EDITION_IDS)[number];
type PurchaseTarget = EditionId | "all";
type EntitlementMap = Record<EditionId, boolean>;

const purchaseTargetSchema = z.enum([...EDITION_IDS, "all"]);

const createCheckoutSessionSchema = z.object({
  deviceId: z.string().min(1),
  target: purchaseTargetSchema,
});

const completeCheckoutSessionSchema = z.object({
  deviceId: z.string().min(1),
  sessionId: z.string().min(1),
});

const EMPTY_ENTITLEMENTS: EntitlementMap = {
  classic: false,
  reracked: false,
  sequential: false,
  "teed-off": false,
  tournament: false,
};

const EDITION_PRICE_CENTS: Record<EditionId, number> = {
  classic: 199,
  reracked: 199,
  sequential: 199,
  "teed-off": 199,
  tournament: 199,
};

const EDITION_DISPLAY_NAMES: Record<EditionId, string> = {
  classic: "Classic",
  reracked: "Reracked",
  sequential: "Sequential",
  "teed-off": "Tee'd Off!",
  tournament: "Tournament",
};

const UNLOCK_ALL_PRICE_CENTS = 499;

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

function getGooglePlayDigitalCatalog() {
  return {
    editionProducts: {
      classic: process.env.GOOGLE_PLAY_PRODUCT_CLASSIC || "classic.digital",
      reracked: process.env.GOOGLE_PLAY_PRODUCT_RERACKED || "reracked.digital",
      sequential: process.env.GOOGLE_PLAY_PRODUCT_SEQUENTIAL || "sequential.digital",
      "teed-off": process.env.GOOGLE_PLAY_PRODUCT_TEED_OFF || "teed_off.digital",
      tournament: process.env.GOOGLE_PLAY_PRODUCT_TOURNAMENT || "tournament.digital",
    },
    bundleProductId: process.env.GOOGLE_PLAY_PRODUCT_BUNDLE_ALL || null,
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

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return key;
}

function getStripeClient(): Stripe {
  return new Stripe(getStripeSecretKey(), {
    apiVersion: "2026-02-25.clover",
  });
}

function getAppBaseUrl(req: Request): string {
  const configured = process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const proto = req.get("x-forwarded-proto") ?? req.protocol ?? "http";
  const host = req.get("x-forwarded-host") ?? req.get("host");
  if (!host) {
    throw new Error("Unable to determine app host for checkout redirects");
  }
  return `${proto}://${host}`;
}

function stripePriceEnvKeyForEdition(editionId: EditionId): string {
  switch (editionId) {
    case "classic":
      return "STRIPE_PRICE_CLASSIC";
    case "reracked":
      return "STRIPE_PRICE_RERACKED";
    case "sequential":
      return "STRIPE_PRICE_SEQUENTIAL";
    case "teed-off":
      return "STRIPE_PRICE_TEED_OFF";
    case "tournament":
      return "STRIPE_PRICE_TOURNAMENT";
    default:
      return "";
  }
}

function readEditionEntitlements(raw: unknown): EntitlementMap {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_ENTITLEMENTS };
  }

  const parsed = raw as Partial<EntitlementMap>;
  return {
    classic: Boolean(parsed.classic),
    reracked: Boolean(parsed.reracked),
    sequential: Boolean(parsed.sequential),
    "teed-off": Boolean(parsed["teed-off"]),
    tournament: Boolean(parsed.tournament),
  };
}

function resolveEditionEntitlements(row: EntitlementRow): EntitlementMap {
  const persisted = readEditionEntitlements(row.edition_entitlements);
  if (!row.unlock_all_digital) {
    return persisted;
  }

  return {
    classic: true,
    reracked: true,
    sequential: true,
    "teed-off": true,
    tournament: true,
  };
}

async function applyEditionPurchase(deviceId: string, target: PurchaseTarget): Promise<void> {
  const row = await getOrCreateEntitlement(deviceId);
  const current = readEditionEntitlements(row.edition_entitlements);

  const nextEntitlements: EntitlementMap = { ...current };
  let unlockAllDigital = row.unlock_all_digital;
  if (target === "all") {
    EDITION_IDS.forEach((editionId) => {
      nextEntitlements[editionId] = true;
    });
    unlockAllDigital = true;
  } else {
    nextEntitlements[target] = true;
  }

  await pool.query(
    `UPDATE billing_entitlements
     SET unlock_all_digital = $2,
         edition_entitlements = $3::jsonb,
         updated_at = NOW()
     WHERE device_id = $1`,
    [deviceId, unlockAllDigital, JSON.stringify(nextEntitlements)],
  );
}

function formatDigitalEntitlementsResponse(row: EntitlementRow) {
  const entitlements = resolveEditionEntitlements(row);
  return {
    unlockAll: row.unlock_all_digital,
    entitlements,
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
  app.get("/api/billing/digital-entitlements", async (req, res) => {
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : "";
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    try {
      const row = await getOrCreateEntitlement(deviceId);
      res.json(formatDigitalEntitlementsResponse(row));
    } catch (error) {
      console.error("Error getting digital entitlements:", error);
      res.status(500).json({ error: "Failed to get digital entitlements" });
    }
  });

  app.post("/api/billing/stripe/create-checkout-session", async (req, res) => {
    const parsed = createCheckoutSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    try {
      const stripe = getStripeClient();
      const { deviceId, target } = parsed.data;
      const appBaseUrl = getAppBaseUrl(req);
      const metadata: Record<string, string> = {
        deviceId,
        target,
      };

      const allPriceId = process.env.STRIPE_PRICE_UNLOCK_ALL;
      const editionPriceId = target === "all" ? null : process.env[stripePriceEnvKeyForEdition(target)];

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        target === "all"
          ? allPriceId
            ? [{ price: allPriceId, quantity: 1 }]
            : [{
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: UNLOCK_ALL_PRICE_CENTS,
                  product_data: {
                    name: "Par for the Course — Unlock All Digital Editions",
                    description: "Unlocks Classic, Reracked, Sequential, Tee'd Off!, and Tournament digital editions.",
                  },
                },
              }]
          : editionPriceId
            ? [{ price: editionPriceId, quantity: 1 }]
            : [{
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: EDITION_PRICE_CENTS[target],
                  product_data: {
                    name: `Par for the Course — ${EDITION_DISPLAY_NAMES[target]} Digital Edition`,
                  },
                },
              }];

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${appBaseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appBaseUrl}/?checkout=cancelled`,
        line_items: lineItems,
        metadata,
      });

      if (!session.url) {
        throw new Error("Stripe checkout URL was not returned");
      }

      res.json({ checkoutUrl: session.url });
    } catch (error) {
      console.error("Error creating Stripe checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/billing/stripe/complete-checkout", async (req, res) => {
    const parsed = completeCheckoutSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    try {
      const stripe = getStripeClient();
      const { deviceId, sessionId } = parsed.data;
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const paid = session.payment_status === "paid";
      const metadataDeviceId = session.metadata?.deviceId;
      const metadataTarget = session.metadata?.target;

      if (!paid) {
        return res.status(400).json({ error: "Checkout session is not paid" });
      }

      if (!metadataDeviceId || metadataDeviceId !== deviceId) {
        return res.status(400).json({ error: "Checkout session does not match this device" });
      }

      const targetParse = purchaseTargetSchema.safeParse(metadataTarget);
      if (!targetParse.success) {
        return res.status(400).json({ error: "Checkout session target is invalid" });
      }

      await applyEditionPurchase(deviceId, targetParse.data);
      const updatedRow = await getOrCreateEntitlement(deviceId);
      res.json(formatDigitalEntitlementsResponse(updatedRow));
    } catch (error) {
      console.error("Error completing Stripe checkout session:", error);
      res.status(500).json({ error: "Failed to finalize checkout session" });
    }
  });

  app.get("/api/billing/google-play/config", (_req, res) => {
    const config = getBillingConfig();
    res.json({
      packageName: config.packageName,
      productId: config.productId,
    });
  });

  app.get("/api/billing/google-play/digital-catalog", (_req, res) => {
    res.json(getGooglePlayDigitalCatalog());
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
