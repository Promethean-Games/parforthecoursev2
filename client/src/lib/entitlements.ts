import { EDITIONS, formatEditionPrice, type EditionId } from "@/lib/editions";
import {
  isGooglePlayBillingSupported,
  purchaseGooglePlayProduct,
  queryGooglePlayCatalog,
  syncGooglePlayPurchases,
} from "@/lib/googlePlayBilling";
import { buildApiUrl } from "@/lib/apiBase";
import { apiRequest } from "@/lib/queryClient";
import { getBillingDeviceId } from "@/lib/billingDevice";
import {
  BillingConfigError,
  BillingRejectedError,
  createBillingApi,
  resolveBillingApiConfig,
  type BillingEnv,
} from "@/lib/billing-api";
import {
  classifyRestore,
  reconcileVerifiedPurchases,
  type RestoreStatus,
  type VerificationResult,
} from "@/lib/play-verification";
import {
  buildGooglePlayCatalog,
  isAllowedProductId,
  normalizeCatalog,
  productIdForTarget,
  resolveEntitlementsFromOwnedProducts,
  resolvePendingFromProducts,
  type EntitlementMap,
  type GooglePlayCatalogResponse,
  type LogicalEntitlementId,
} from "@/lib/play-products";
import {
  APPLE_BUNDLE_PRODUCT_ID,
  APPLE_EDITION_PRODUCT_IDS,
  ALLOWED_APPLE_PRODUCT_IDS,
  appleGrantForProduct,
} from "@/lib/apple-products";
import {
  finishAppleStoreTransaction,
  isAppleStoreKitBillingSupported,
  listenForAppleTransactionUpdates,
  purchaseAppleStoreProduct,
  queryAppleStoreProducts,
  syncAppleStoreTransactions,
  type AppleTransactionRecord,
} from "@/lib/appleStoreKitBilling";
import { getBillingPlatform } from "@/lib/billingPlatform";

const STORAGE_KEY = "digitalEditionEntitlements";
const TEST_ACCESS_STORAGE_KEY = "digitalEditionTestAccess";
const TEST_ACCESS_BASELINE_STORAGE_KEY = "digitalEditionTestAccessBaseline";
const STORE_PRICE_CACHE_KEY = "digitalEditionStorePriceCache";
const GOOGLE_PLAY_CATALOG_CACHE_KEY = "googlePlayDigitalCatalog";
const PENDING_STATE_CACHE_KEY = "digitalEditionPendingState";

// Temporary Play Store QA unlock. Remove after tester access is no longer needed.
export const TEST_ACCESS_CODE = "PLAYTEST";

type PendingMap = Record<EditionId, boolean>;
export type PurchaseTarget = EditionId | "all";
export type PurchaseOutcome = "purchased" | "pending" | "cancelled";

interface StorePriceCache {
  editionPrices: Partial<Record<EditionId, string>>;
  unlockAllPrice: string | null;
  updatedAt: string;
}

export interface DigitalStorePricing {
  editionPrices: Partial<Record<EditionId, string>>;
  unlockAllPrice: string | null;
}

const EMPTY_ENTITLEMENTS: EntitlementMap = {
  classic: false,
  reracked: false,
  sequential: false,
  "teed-off": false,
  tournament: false,
};

const EMPTY_PENDING: PendingMap = {
  classic: false,
  reracked: false,
  sequential: false,
  "teed-off": false,
  tournament: false,
};

const ENTITLEMENT_TO_EDITION: Record<LogicalEntitlementId, EditionId | null> = {
  edition_classic: "classic",
  edition_reracked: "reracked",
  edition_sequential: "sequential",
  edition_tournament: "tournament",
  edition_teed_off: "teed-off",
  bundle_all_editions: null,
};

function readStoredEntitlements(): EntitlementMap {
  if (typeof window === "undefined") return { ...EMPTY_ENTITLEMENTS };
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) return { ...EMPTY_ENTITLEMENTS };

  try {
    const parsed = JSON.parse(raw) as Partial<EntitlementMap>;
    return {
      classic: Boolean(parsed.classic),
      reracked: Boolean(parsed.reracked),
      sequential: Boolean(parsed.sequential),
      "teed-off": Boolean(parsed["teed-off"]),
      tournament: Boolean(parsed.tournament),
    };
  } catch {
    return { ...EMPTY_ENTITLEMENTS };
  }
}

function readPendingState(): PendingMap {
  if (typeof window === "undefined") return { ...EMPTY_PENDING };
  const raw = localStorage.getItem(PENDING_STATE_CACHE_KEY);
  if (!raw) return { ...EMPTY_PENDING };
  try {
    const parsed = JSON.parse(raw) as Partial<PendingMap>;
    return {
      classic: Boolean(parsed.classic),
      reracked: Boolean(parsed.reracked),
      sequential: Boolean(parsed.sequential),
      "teed-off": Boolean(parsed["teed-off"]),
      tournament: Boolean(parsed.tournament),
    };
  } catch {
    return { ...EMPTY_PENDING };
  }
}

function writePendingState(value: PendingMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_STATE_CACHE_KEY, JSON.stringify(value));
}

function writeEntitlements(value: EntitlementMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function writeStorePricing(value: StorePriceCache): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_PRICE_CACHE_KEY, JSON.stringify(value));
}

function readStorePricing(): StorePriceCache | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORE_PRICE_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StorePriceCache>;
    return {
      editionPrices: (parsed.editionPrices && typeof parsed.editionPrices === "object") ? parsed.editionPrices : {},
      unlockAllPrice: typeof parsed.unlockAllPrice === "string" ? parsed.unlockAllPrice : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function buildFallbackStorePricing(): DigitalStorePricing {
  const editionPrices: Partial<Record<EditionId, string>> = {};
  EDITIONS.forEach((edition) => {
    editionPrices[edition.id] = formatEditionPrice(edition.priceCents);
  });
  return {
    editionPrices,
    unlockAllPrice: null,
  };
}

export function hasTestingAccess(): boolean {
  if (typeof window === "undefined" || getBillingPlatform() === "ios") return false;
  return localStorage.getItem(TEST_ACCESS_STORAGE_KEY) === "true";
}

function readEntitlements(): EntitlementMap {
  const baseEntitlements = readStoredEntitlements();

  if (hasTestingAccess()) {
    return {
      classic: true,
      reracked: true,
      sequential: true,
      "teed-off": true,
      tournament: true,
    };
  }

  return baseEntitlements;
}

export function setTestingAccess(enabled: boolean): void {
  if (typeof window === "undefined" || getBillingPlatform() === "ios") return;

  if (enabled) {
    const baseline = readStoredEntitlements();
    localStorage.setItem(TEST_ACCESS_BASELINE_STORAGE_KEY, JSON.stringify(baseline));
    localStorage.setItem(TEST_ACCESS_STORAGE_KEY, "true");
    writeEntitlements({
      classic: true,
      reracked: true,
      sequential: true,
      "teed-off": true,
      tournament: true,
    });
    return;
  }

  localStorage.setItem(TEST_ACCESS_STORAGE_KEY, "false");
  const savedBaseline = localStorage.getItem(TEST_ACCESS_BASELINE_STORAGE_KEY);
  const restoredEntitlements = savedBaseline
    ? (() => {
      try {
        const parsed = JSON.parse(savedBaseline) as Partial<EntitlementMap>;
        return {
          classic: Boolean(parsed.classic),
          reracked: Boolean(parsed.reracked),
          sequential: Boolean(parsed.sequential),
          "teed-off": Boolean(parsed["teed-off"]),
          tournament: Boolean(parsed.tournament),
        };
      } catch {
        return { ...EMPTY_ENTITLEMENTS };
      }
    })()
    : { ...EMPTY_ENTITLEMENTS };

  writeEntitlements(restoredEntitlements);
  localStorage.removeItem(TEST_ACCESS_BASELINE_STORAGE_KEY);
}

export async function unlockAllTestEntitlements(code: string): Promise<boolean> {
  if (getBillingPlatform() === "ios") return false;
  if (code.trim().toUpperCase() !== TEST_ACCESS_CODE) {
    return false;
  }

  setTestingAccess(true);
  return true;
}

async function getGooglePlayCatalog(): Promise<GooglePlayCatalogResponse> {
  if (typeof window === "undefined") {
    throw new Error("Google Play catalog is unavailable in this environment.");
  }

  if (isGooglePlayBillingSupported()) {
    // The native catalog is fixed in code; a cached copy from an older build is never trusted.
    const nativeCatalog = buildGooglePlayCatalog();
    localStorage.setItem(GOOGLE_PLAY_CATALOG_CACHE_KEY, JSON.stringify(nativeCatalog));
    return nativeCatalog;
  }

  try {
    const response = await fetch(buildApiUrl("/api/billing/google-play/digital-catalog"));
    if (!response.ok) {
      throw new Error((await response.text()) || "Failed to load Google Play catalog");
    }

    const data = normalizeCatalog(await response.json() as Partial<GooglePlayCatalogResponse>);
    localStorage.setItem(GOOGLE_PLAY_CATALOG_CACHE_KEY, JSON.stringify(data));
    return data;
  } catch (error) {
    const cached = localStorage.getItem(GOOGLE_PLAY_CATALOG_CACHE_KEY);
    if (cached) {
      try {
        return normalizeCatalog(JSON.parse(cached) as Partial<GooglePlayCatalogResponse>);
      } catch {
        // continue to throw original error below
      }
    }

    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to load Google Play catalog.");
  }
}

// Config is resolved lazily so a device with no purchases to verify never needs it.
function getBillingApi() {
  return createBillingApi(resolveBillingApiConfig(import.meta.env as BillingEnv), {
    fetch: (input, init) => fetch(input, init),
    getDeviceId: getBillingDeviceId,
  });
}

let reconcileInFlight: Promise<VerificationResult> | null = null;
const appleTransactionReconciliations = new Map<string, Promise<EntitlementMap>>();
let appleUpdatesListenerInstalled = false;

function ensureAppleTransactionUpdatesListener(): void {
  if (!isAppleStoreKitBillingSupported() || appleUpdatesListenerInstalled) return;
  appleUpdatesListenerInstalled = true;
  listenForAppleTransactionUpdates((transaction) => {
    void reconcileAppleTransaction(transaction, true).catch((error) => {
      console.error(
        "Apple transaction update could not be verified:",
        error instanceof Error ? error.message : error,
      );
    });
  });
}

function reconcileAppleTransaction(
  transaction: AppleTransactionRecord,
  finishAfterVerification: boolean,
): Promise<EntitlementMap> {
  if (!ALLOWED_APPLE_PRODUCT_IDS.has(transaction.productId)) {
    return Promise.reject(new Error("Unsupported Apple product."));
  }

  const existing = appleTransactionReconciliations.get(transaction.transactionId);
  if (existing) return existing;

  const reconciliation = (async () => {
    const billingApi = getBillingApi();
    await billingApi.verifyApplePurchase({ signedTransaction: transaction.signedTransaction });
    const serverEntitlements = await billingApi.fetchEntitlements();
    writeEntitlements(serverEntitlements.entitlements);
    const pending = readPendingState();
    const grant = appleGrantForProduct(transaction.productId);
    if (grant === "all") {
      (Object.keys(pending) as EditionId[]).forEach((editionId) => {
        pending[editionId] = false;
      });
    } else if (grant) {
      pending[grant] = false;
    }
    writePendingState(pending);
    if (finishAfterVerification && transaction.unfinished) {
      await finishAppleStoreTransaction(transaction.transactionId);
    }
    return serverEntitlements.entitlements;
  })();

  appleTransactionReconciliations.set(transaction.transactionId, reconciliation);
  void reconciliation.catch(() => {
    appleTransactionReconciliations.delete(transaction.transactionId);
  });
  return reconciliation;
}

async function reconcileAppleStoreTransactions(restore = false): Promise<EntitlementMap> {
  ensureAppleTransactionUpdatesListener();
  const transactions = await syncAppleStoreTransactions(restore);
  for (const transaction of transactions) {
    await reconcileAppleTransaction(transaction, true);
  }
  const serverEntitlements = await getBillingApi().fetchEntitlements();
  writeEntitlements(serverEntitlements.entitlements);
  return serverEntitlements.entitlements;
}

// Grants come only from purchases the Supabase billing function verified with Google Play.
// Repeated calls share one run; the server upsert is idempotent for repeated tokens.
function reconcileGooglePlayEntitlements(): Promise<VerificationResult> {
  if (reconcileInFlight) return reconcileInFlight;

  reconcileInFlight = (async () => {
    const result = await reconcileVerifiedPurchases({
      sync: syncGooglePlayPurchases,
      verifyPurchase: (purchase) => getBillingApi().verifyPurchase(purchase),
      fetchEntitlements: () => getBillingApi().fetchEntitlements(),
      readCached: readStoredEntitlements,
    });
    if (result.authoritative) {
      writeEntitlements(result.entitlements);
      writePendingState(result.pending);
    }
    return result;
  })().finally(() => {
    reconcileInFlight = null;
  });

  return reconcileInFlight;
}

async function reconcileServerEntitlements(): Promise<EntitlementMap> {
  const deviceId = getBillingDeviceId();
  const response = await fetch(
    buildApiUrl(`/api/billing/digital-entitlements?deviceId=${encodeURIComponent(deviceId)}`),
  );
  if (!response.ok) {
    throw new Error((await response.text()) || "Failed to load entitlements");
  }

  const data = await response.json() as { entitlements?: Partial<EntitlementMap> };
  const serverEntitlements: EntitlementMap = {
    classic: Boolean(data.entitlements?.classic),
    reracked: Boolean(data.entitlements?.reracked),
    sequential: Boolean(data.entitlements?.sequential),
    "teed-off": Boolean(data.entitlements?.["teed-off"]),
    tournament: Boolean(data.entitlements?.tournament),
  };
  writeEntitlements(serverEntitlements);
  return serverEntitlements;
}

export async function getDigitalStorePricing(): Promise<DigitalStorePricing> {
  const fallbackPricing = buildFallbackStorePricing();
  if (getBillingPlatform() === "ios") {
    const editionPrices: Partial<Record<EditionId, string>> = {};
    let unlockAllPrice: string | null = null;
    try {
      const products = await queryAppleStoreProducts();
      for (const product of products) {
        if (!product.available || !product.formattedPrice) continue;
        const target = appleGrantForProduct(product.productId);
        if (target === "all") {
          unlockAllPrice = product.formattedPrice;
        } else if (target) {
          editionPrices[target] = product.formattedPrice;
        }
      }
    } catch {
      // Do not show estimated non-App-Store pricing in the iOS purchase flow.
    }
    if (!isAppleStoreKitBillingSupported()) {
      return {
        editionPrices: Object.fromEntries(
          Object.keys(APPLE_EDITION_PRODUCT_IDS).map((id) => [id, "Unavailable"]),
        ) as Partial<Record<EditionId, string>>,
        unlockAllPrice: null,
      };
    }
    return {
      editionPrices: Object.fromEntries(
        Object.keys(APPLE_EDITION_PRODUCT_IDS).map((id) => [id, editionPrices[id as EditionId] ?? "Unavailable"]),
      ) as Partial<Record<EditionId, string>>,
      unlockAllPrice,
    };
  }

  if (hasTestingAccess()) {
    return fallbackPricing;
  }

  if (!isGooglePlayBillingSupported()) {
    return fallbackPricing;
  }

  try {
    const catalog = await getGooglePlayCatalog();
    const requestedProductIds = [
      ...Object.values(catalog.editionProducts).filter((productId): productId is string => Boolean(productId)),
      ...(catalog.bundleProductId ? [catalog.bundleProductId] : []),
    ];

    if (requestedProductIds.length === 0) {
      throw new Error("No Google Play product IDs are configured for digital editions.");
    }

    const details = await queryGooglePlayCatalog(requestedProductIds);
    const detailsByProductId = new Map(details.map((detail) => [detail.productId, detail]));

    const editionPrices: Partial<Record<EditionId, string>> = {};
    (Object.keys(catalog.editionProducts) as EditionId[]).forEach((editionId) => {
      const productId = catalog.editionProducts[editionId];
      if (!productId) return;
      const detail = detailsByProductId.get(productId);
      const price = detail?.formattedPrice;
      if (typeof price === "string" && price.trim().length > 0) {
        editionPrices[editionId] = price;
      }
    });

    const unlockAllPrice =
      catalog.bundleProductId
        ? detailsByProductId.get(catalog.bundleProductId)?.formattedPrice ?? null
        : null;

    const merged: DigitalStorePricing = {
      editionPrices: { ...fallbackPricing.editionPrices, ...editionPrices },
      unlockAllPrice: unlockAllPrice ?? fallbackPricing.unlockAllPrice,
    };

    writeStorePricing({
      editionPrices: merged.editionPrices,
      unlockAllPrice: merged.unlockAllPrice,
      updatedAt: new Date().toISOString(),
    });

    return merged;
  } catch {
    const cached = readStorePricing();
    if (cached) {
      return {
        editionPrices: { ...fallbackPricing.editionPrices, ...cached.editionPrices },
        unlockAllPrice: cached.unlockAllPrice ?? fallbackPricing.unlockAllPrice,
      };
    }

    return fallbackPricing;
  }
}

export async function getDigitalEntitlements(): Promise<EntitlementMap> {
  if (getBillingPlatform() === "ios") {
    if (!isAppleStoreKitBillingSupported()) return { ...EMPTY_ENTITLEMENTS };
    try {
      return await reconcileAppleStoreTransactions();
    } catch {
      return { ...EMPTY_ENTITLEMENTS };
    }
  }

  if (hasTestingAccess()) {
    return readEntitlements();
  }

  if (isGooglePlayBillingSupported()) {
    try {
      const result = await reconcileGooglePlayEntitlements();
      return result.authoritative ? result.entitlements : readStoredEntitlements();
    } catch {
      // Includes missing config and network failures: keep previously verified entitlements.
      return readStoredEntitlements();
    }
  }

  try {
    return await reconcileServerEntitlements();
  } catch {
    return readStoredEntitlements();
  }
}

// Instant, offline answer from entitlements verified earlier (or tester access). Never grants anything new.
export function hasCachedDigitalAccess(editionId: EditionId): boolean {
  if (getBillingPlatform() === "ios") return false;
  return Boolean(readEntitlements()[editionId]);
}

export async function hasDigitalAccess(editionId: EditionId): Promise<boolean> {
  const entitlements = await getDigitalEntitlements();
  return Boolean(entitlements[editionId]);
}

export interface RestoreResult {
  status: RestoreStatus | "not-configured" | "no-play";
  entitlements: EntitlementMap;
}

// Re-queries Google Play for owned purchases and sends them through the same server-side
// verification as a fresh purchase. Previously verified entitlements are never cleared by a failure.
export async function restoreDigitalPurchases(): Promise<RestoreResult> {
  if (getBillingPlatform() === "ios") {
    if (!isAppleStoreKitBillingSupported()) {
      return { status: "unavailable", entitlements: { ...EMPTY_ENTITLEMENTS } };
    }
    try {
      const entitlements = await reconcileAppleStoreTransactions(true);
      return {
        status: Object.values(entitlements).some(Boolean) ? "restored" : "none",
        entitlements,
      };
    } catch (error) {
      if (error instanceof BillingConfigError) {
        return { status: "not-configured", entitlements: { ...EMPTY_ENTITLEMENTS } };
      }
      return {
        status: error instanceof BillingRejectedError ? "rejected" : "unavailable",
        entitlements: { ...EMPTY_ENTITLEMENTS },
      };
    }
  }

  if (!isGooglePlayBillingSupported()) {
    return { status: "no-play", entitlements: await getDigitalEntitlements() };
  }
  try {
    const result = await reconcileGooglePlayEntitlements();
    return {
      status: classifyRestore(result),
      entitlements: result.authoritative ? result.entitlements : readStoredEntitlements(),
    };
  } catch (error) {
    if (error instanceof BillingConfigError) {
      return { status: "not-configured", entitlements: readStoredEntitlements() };
    }
    throw error;
  }
}

async function purchaseViaGooglePlay(target: PurchaseTarget): Promise<PurchaseOutcome> {
  const catalog = await getGooglePlayCatalog();
  const productId = productIdForTarget(target, catalog);

  if (!productId || !isAllowedProductId(productId)) {
    throw new Error("This product is not configured in Google Play Console yet.");
  }

  const purchase = await purchaseGooglePlayProduct(productId);

  if (purchase.status === "pending") {
    const pending = readPendingState();
    if (target === "all") {
      (Object.keys(pending) as EditionId[]).forEach((editionId) => {
        pending[editionId] = true;
      });
    } else {
      pending[target] = true;
    }
    writePendingState(pending);
    return "pending";
  }

  if (purchase.status === "cancelled") {
    return "cancelled";
  }

  // Never grant from the purchase result itself: verify with the server first. Errors
  // (e.g. missing billing config) propagate so the user sees a clear message.
  const result = await reconcileGooglePlayEntitlements();
  const outcome = result.outcomes[productId];
  if (outcome === "verified") {
    return "purchased";
  }
  if (outcome === "unavailable") {
    throw new Error(
      "Your purchase went through but could not be verified yet. Check your connection and reopen the app; it will unlock automatically.",
    );
  }
  throw new Error("Google Play purchase could not be verified.");
}

async function purchaseViaApple(target: PurchaseTarget): Promise<PurchaseOutcome> {
  ensureAppleTransactionUpdatesListener();
  const productId = target === "all" ? APPLE_BUNDLE_PRODUCT_ID : APPLE_EDITION_PRODUCT_IDS[target];
  const purchase = await purchaseAppleStoreProduct(productId);

  if (purchase.status === "pending") {
    const pending = readPendingState();
    if (target === "all") {
      (Object.keys(pending) as EditionId[]).forEach((editionId) => {
        pending[editionId] = true;
      });
    } else {
      pending[target] = true;
    }
    writePendingState(pending);
    return "pending";
  }
  if (purchase.status === "cancelled") return "cancelled";

  const entitlements = await reconcileAppleTransaction(purchase.transaction, true);
  const hasRequestedEntitlement = target === "all"
    ? Object.values(entitlements).every(Boolean)
    : entitlements[target];
  if (!hasRequestedEntitlement) {
    throw new Error("Apple purchase was received, but the server has not confirmed access yet.");
  }
  return "purchased";
}

async function purchaseViaStripe(target: PurchaseTarget): Promise<PurchaseOutcome> {
  const deviceId = getBillingDeviceId();
  const response = await apiRequest(
    "POST",
    buildApiUrl("/api/billing/stripe/create-checkout-session"),
    {
      deviceId,
      target,
    },
  );
  const data = await response.json() as { checkoutUrl?: string };
  if (!data.checkoutUrl) {
    throw new Error("Checkout URL was not returned");
  }

  if (typeof window !== "undefined") {
    window.location.assign(data.checkoutUrl);
  }

  return "purchased";
}

export async function purchaseDigitalEdition(target: PurchaseTarget): Promise<PurchaseOutcome> {
  if (getBillingPlatform() === "ios") {
    if (!isAppleStoreKitBillingSupported()) {
      throw new Error("Apple in-app purchases are unavailable. Please restart the app or contact support.");
    }
    return purchaseViaApple(target);
  }
  if (isGooglePlayBillingSupported()) {
    return purchaseViaGooglePlay(target);
  }

  return purchaseViaStripe(target);
}

export async function finalizeStripeCheckoutFromUrl(): Promise<void> {
  if (typeof window === "undefined" || getBillingPlatform() === "ios") return;

  const url = new URL(window.location.href);
  const checkoutState = url.searchParams.get("checkout");
  const sessionId = url.searchParams.get("session_id");
  if (checkoutState !== "success" || !sessionId) {
    return;
  }

  const deviceId = getBillingDeviceId();
  await apiRequest(
    "POST",
    buildApiUrl("/api/billing/stripe/complete-checkout"),
    {
      deviceId,
      sessionId,
    },
  );

  await getDigitalEntitlements();
  url.searchParams.delete("checkout");
  url.searchParams.delete("session_id");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export async function setMockDigitalAccess(editionId: EditionId, unlocked: boolean): Promise<void> {
  if (getBillingPlatform() === "ios") return;
  const entitlements = readEntitlements();
  entitlements[editionId] = unlocked;
  writeEntitlements(entitlements);
}

export function logicalEntitlementForEdition(editionId: EditionId): LogicalEntitlementId {
  switch (editionId) {
    case "classic":
      return "edition_classic";
    case "reracked":
      return "edition_reracked";
    case "sequential":
      return "edition_sequential";
    case "tournament":
      return "edition_tournament";
    case "teed-off":
      return "edition_teed_off";
    default:
      return "edition_classic";
  }
}

export function editionForLogicalEntitlement(logicalId: LogicalEntitlementId): EditionId | null {
  return ENTITLEMENT_TO_EDITION[logicalId];
}
