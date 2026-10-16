import type { EditionId } from "./editions";

// Google Play product IDs confirmed in Play Console. These are store identifiers and are
// deliberately separate from the app's internal edition IDs ("classic", "teed-off", ...).
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

export type LogicalEntitlementId =
  | "edition_classic"
  | "edition_reracked"
  | "edition_sequential"
  | "edition_tournament"
  | "edition_teed_off"
  | "bundle_all_editions";

export type EntitlementMap = Record<EditionId, boolean>;

export interface GooglePlayCatalogResponse {
  editionProducts: Record<EditionId, string | null>;
  bundleProductId: string | null;
  logicalEntitlements: Record<LogicalEntitlementId, string>;
}

type CatalogProducts = Pick<GooglePlayCatalogResponse, "editionProducts" | "bundleProductId">;

const EDITION_IDS = Object.keys(EDITION_PRODUCT_IDS) as EditionId[];

const EMPTY_ENTITLEMENTS: EntitlementMap = {
  classic: false,
  reracked: false,
  sequential: false,
  "teed-off": false,
  tournament: false,
};

export function buildGooglePlayCatalog(): GooglePlayCatalogResponse {
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

// Server catalogs (including the legacy Express defaults) and cached catalogs may carry
// obsolete or unknown IDs. The confirmed IDs are the only source of truth, so the payload
// is intentionally ignored.
export function normalizeCatalog(_payload?: unknown): GooglePlayCatalogResponse {
  return buildGooglePlayCatalog();
}

export function isAllowedProductId(productId: string): boolean {
  return ALLOWED_PRODUCT_IDS.has(productId);
}

export function resolveEntitlementsFromOwnedProducts(
  ownedProductIds: Iterable<string>,
  catalog: CatalogProducts = buildGooglePlayCatalog(),
): EntitlementMap {
  const owned = new Set(ownedProductIds);

  if (catalog.bundleProductId && owned.has(catalog.bundleProductId)) {
    return { classic: true, reracked: true, sequential: true, "teed-off": true, tournament: true };
  }

  const next: EntitlementMap = { ...EMPTY_ENTITLEMENTS };
  EDITION_IDS.forEach((editionId) => {
    const productId = catalog.editionProducts[editionId];
    if (productId && owned.has(productId)) {
      next[editionId] = true;
    }
  });
  return next;
}

export function resolvePendingFromProducts(
  pendingProductIds: Iterable<string>,
  catalog: CatalogProducts = buildGooglePlayCatalog(),
): EntitlementMap {
  const pending = new Set(pendingProductIds);
  // A pending bundle purchase leaves every edition pending.
  const bundlePending = Boolean(catalog.bundleProductId && pending.has(catalog.bundleProductId));
  const next: EntitlementMap = { ...EMPTY_ENTITLEMENTS };
  EDITION_IDS.forEach((editionId) => {
    const productId = catalog.editionProducts[editionId];
    if (bundlePending || (productId && pending.has(productId))) {
      next[editionId] = true;
    }
  });
  return next;
}

export function productIdForTarget(
  target: EditionId | "all",
  catalog: CatalogProducts = buildGooglePlayCatalog(),
): string | null {
  return target === "all" ? catalog.bundleProductId : catalog.editionProducts[target];
}
