import { EDITIONS, formatEditionPrice, type EditionId } from "@/lib/editions";
import {
  isGooglePlayBillingSupported,
  purchaseGooglePlayProduct,
  queryGooglePlayCatalog,
  syncGooglePlayPurchases,
} from "@/lib/googlePlayBilling";
import { apiRequest } from "@/lib/queryClient";
import { getBillingDeviceId } from "@/lib/billingDevice";

const STORAGE_KEY = "digitalEditionEntitlements";
const TEST_ACCESS_STORAGE_KEY = "digitalEditionTestAccess";
const TEST_ACCESS_BASELINE_STORAGE_KEY = "digitalEditionTestAccessBaseline";
const STORE_PRICE_CACHE_KEY = "digitalEditionStorePriceCache";
const GOOGLE_PLAY_CATALOG_CACHE_KEY = "googlePlayDigitalCatalog";
const PENDING_STATE_CACHE_KEY = "digitalEditionPendingState";

// Temporary Play Store QA unlock. Remove after tester access is no longer needed.
export const TEST_ACCESS_CODE = "PLAYTEST";

type EntitlementMap = Record<EditionId, boolean>;
type PendingMap = Record<EditionId, boolean>;
export type PurchaseTarget = EditionId | "all";
export type PurchaseOutcome = "purchased" | "pending" | "cancelled";

type LogicalEntitlementId =
  | "edition_classic"
  | "edition_reracked"
  | "edition_sequential"
  | "edition_tournament"
  | "edition_teed_off"
  | "bundle_all_editions";

interface GooglePlayCatalogResponse {
  editionProducts: Record<EditionId, string | null>;
  bundleProductId: string | null;
  logicalEntitlements: Record<LogicalEntitlementId, string>;
}

interface StorePriceCache {
  editionPrices: Partial<Record<EditionId, string>>;
  unlockAllPrice: string | null;
  updatedAt: string;
}

export interface DigitalStorePricing {
  editionPrices: Partial<Record<EditionId, string>>;
  unlockAllPrice: string | null;
}

const DEFAULT_NATIVE_GOOGLE_PLAY_CATALOG: GooglePlayCatalogResponse = {
  editionProducts: {
    classic: "classic",
    reracked: "reracked",
    sequential: "sequential",
    "teed-off": "teed-off",
    tournament: "tournament",
  },
  bundleProductId: "bundle_all_editions",
  logicalEntitlements: {
    edition_classic: "classic",
    edition_reracked: "reracked",
    edition_sequential: "sequential",
    edition_tournament: "tournament",
    edition_teed_off: "teed-off",
    bundle_all_editions: "all",
  },
};

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
  if (typeof window === "undefined") return false;
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
  if (typeof window === "undefined") return;

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
  if (code.trim().toUpperCase() !== TEST_ACCESS_CODE) {
    return false;
  }

  setTestingAccess(true);
  return true;
}

function mergePendingFromProducts(
  pendingProductIds: Set<string>,
  editionProducts: Record<EditionId, string | null>,
): PendingMap {
  const pending: PendingMap = { ...EMPTY_PENDING };
  (Object.keys(editionProducts) as EditionId[]).forEach((editionId) => {
    const productId = editionProducts[editionId];
    if (productId && pendingProductIds.has(productId)) {
      pending[editionId] = true;
    }
  });
  return pending;
}

function resolveEntitlementsFromOwnedProducts(
  ownedProductIds: Set<string>,
  editionProducts: Record<EditionId, string | null>,
  bundleProductId: string | null,
): EntitlementMap {
  if (bundleProductId && ownedProductIds.has(bundleProductId)) {
    return {
      classic: true,
      reracked: true,
      sequential: true,
      "teed-off": true,
      tournament: true,
    };
  }

  const next: EntitlementMap = { ...EMPTY_ENTITLEMENTS };
  (Object.keys(editionProducts) as EditionId[]).forEach((editionId) => {
    const productId = editionProducts[editionId];
    if (productId && ownedProductIds.has(productId)) {
      next[editionId] = true;
    }
  });
  return next;
}

function normalizeCatalog(payload: Partial<GooglePlayCatalogResponse>): GooglePlayCatalogResponse {
  const editionProducts: Partial<Record<EditionId, string | null>> = payload.editionProducts ?? {};
  return {
    editionProducts: {
      classic: typeof editionProducts.classic === "string" && editionProducts.classic.trim().length > 0
        ? editionProducts.classic
        : null,
      reracked: typeof editionProducts.reracked === "string" && editionProducts.reracked.trim().length > 0
        ? editionProducts.reracked
        : null,
      sequential: typeof editionProducts.sequential === "string" && editionProducts.sequential.trim().length > 0
        ? editionProducts.sequential
        : null,
      "teed-off": typeof editionProducts["teed-off"] === "string" && editionProducts["teed-off"].trim().length > 0
        ? editionProducts["teed-off"]
        : null,
      tournament: typeof editionProducts.tournament === "string" && editionProducts.tournament.trim().length > 0
        ? editionProducts.tournament
        : null,
    },
    bundleProductId:
      typeof payload.bundleProductId === "string" && payload.bundleProductId.trim().length > 0
        ? payload.bundleProductId
        : null,
    logicalEntitlements: {
      edition_classic: payload.logicalEntitlements?.edition_classic ?? "classic",
      edition_reracked: payload.logicalEntitlements?.edition_reracked ?? "reracked",
      edition_sequential: payload.logicalEntitlements?.edition_sequential ?? "sequential",
      edition_tournament: payload.logicalEntitlements?.edition_tournament ?? "tournament",
      edition_teed_off: payload.logicalEntitlements?.edition_teed_off ?? "teed-off",
      bundle_all_editions: payload.logicalEntitlements?.bundle_all_editions ?? "all",
    },
  };
}

function getNativeGooglePlayCatalog(): GooglePlayCatalogResponse {
  if (typeof window === "undefined") {
    return { ...DEFAULT_NATIVE_GOOGLE_PLAY_CATALOG };
  }

  const cached = localStorage.getItem(GOOGLE_PLAY_CATALOG_CACHE_KEY);
  if (cached) {
    try {
      return normalizeCatalog(JSON.parse(cached) as Partial<GooglePlayCatalogResponse>);
    } catch {
      // Fall through to the app defaults below.
    }
  }

  return { ...DEFAULT_NATIVE_GOOGLE_PLAY_CATALOG };
}

async function getGooglePlayCatalog(): Promise<GooglePlayCatalogResponse> {
  if (typeof window === "undefined") {
    throw new Error("Google Play catalog is unavailable in this environment.");
  }

  if (isGooglePlayBillingSupported()) {
    const nativeCatalog = getNativeGooglePlayCatalog();
    localStorage.setItem(GOOGLE_PLAY_CATALOG_CACHE_KEY, JSON.stringify(nativeCatalog));
    return nativeCatalog;
  }

  try {
    const response = await fetch("/api/billing/google-play/digital-catalog");
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

async function reconcileGooglePlayEntitlements(): Promise<EntitlementMap> {
  const catalog = await getGooglePlayCatalog();
  const synced = await syncGooglePlayPurchases();
  if (!synced.authoritative) {
    throw new Error("Google Play purchase data is not authoritative.");
  }

  const owned = new Set(synced.ownedProductIds);
  const pending = new Set(synced.pendingProductIds);
  const resolved = resolveEntitlementsFromOwnedProducts(
    owned,
    catalog.editionProducts,
    catalog.bundleProductId,
  );
  const pendingMap = mergePendingFromProducts(pending, catalog.editionProducts);

  writeEntitlements(resolved);
  writePendingState(pendingMap);
  return resolved;
}

async function reconcileServerEntitlements(): Promise<EntitlementMap> {
  const deviceId = getBillingDeviceId();
  const response = await fetch(`/api/billing/digital-entitlements?deviceId=${encodeURIComponent(deviceId)}`);
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
  if (hasTestingAccess()) {
    return readEntitlements();
  }

  if (isGooglePlayBillingSupported()) {
    try {
      return await reconcileGooglePlayEntitlements();
    } catch {
      return readStoredEntitlements();
    }
  }

  try {
    return await reconcileServerEntitlements();
  } catch {
    return readStoredEntitlements();
  }
}

export async function hasDigitalAccess(editionId: EditionId): Promise<boolean> {
  const entitlements = await getDigitalEntitlements();
  return Boolean(entitlements[editionId]);
}

async function purchaseViaGooglePlay(target: PurchaseTarget): Promise<PurchaseOutcome> {
  const catalog = await getGooglePlayCatalog();
  const productId = target === "all" ? catalog.bundleProductId : catalog.editionProducts[target];

  if (!productId) {
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

  await reconcileGooglePlayEntitlements().catch(() => {
    // Keep prior verified entitlements if reconciliation fails.
  });
  return "purchased";
}

async function purchaseViaStripe(target: PurchaseTarget): Promise<PurchaseOutcome> {
  const deviceId = getBillingDeviceId();
  const response = await apiRequest("POST", "/api/billing/stripe/create-checkout-session", {
    deviceId,
    target,
  });
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
  if (isGooglePlayBillingSupported()) {
    return purchaseViaGooglePlay(target);
  }

  return purchaseViaStripe(target);
}

export async function finalizeStripeCheckoutFromUrl(): Promise<void> {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const checkoutState = url.searchParams.get("checkout");
  const sessionId = url.searchParams.get("session_id");
  if (checkoutState !== "success" || !sessionId) {
    return;
  }

  const deviceId = getBillingDeviceId();
  await apiRequest("POST", "/api/billing/stripe/complete-checkout", {
    deviceId,
    sessionId,
  });

  await getDigitalEntitlements();
  url.searchParams.delete("checkout");
  url.searchParams.delete("session_id");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export async function setMockDigitalAccess(editionId: EditionId, unlocked: boolean): Promise<void> {
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
