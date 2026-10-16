import type { GooglePlayPurchaseRecord, GooglePlaySyncResult } from "./googlePlayBilling";
import {
  BillingConfigError,
  BillingRejectedError,
  BillingTransientError,
  type ServerEntitlements,
} from "./billing-api";
import {
  isAllowedProductId,
  resolveEntitlementsFromOwnedProducts,
  resolvePendingFromProducts,
  type EntitlementMap,
} from "./play-products";

export type ProductOutcome = "verified" | "rejected" | "unavailable";

export interface VerificationDeps {
  sync: () => Promise<GooglePlaySyncResult>;
  verifyPurchase: (purchase: { productId: string; purchaseToken: string }) => Promise<void>;
  fetchEntitlements: () => Promise<ServerEntitlements>;
  readCached: () => EntitlementMap;
}

export interface VerificationResult {
  entitlements: EntitlementMap;
  pending: EntitlementMap;
  // False when nothing authoritative was learned (e.g. Play unavailable): keep cached state as is.
  authoritative: boolean;
  outcomes: Record<string, ProductOutcome>;
}

const EDITION_KEYS: Array<keyof EntitlementMap> = ["classic", "reracked", "sequential", "teed-off", "tournament"];

function emptyMap(): EntitlementMap {
  return { classic: false, reracked: false, sequential: false, "teed-off": false, tournament: false };
}

// Entitlements are granted only for products whose purchase token the server verified AND whose
// editions the server's entitlement record confirms. A purchase reported by the device alone,
// or a pending purchase, never grants access.
export async function reconcileVerifiedPurchases(deps: VerificationDeps): Promise<VerificationResult> {
  const cached = deps.readCached();

  let synced: GooglePlaySyncResult;
  try {
    synced = await deps.sync();
  } catch {
    return { entitlements: cached, pending: emptyMap(), authoritative: false, outcomes: {} };
  }
  if (!synced.authoritative) {
    return { entitlements: cached, pending: emptyMap(), authoritative: false, outcomes: {} };
  }

  const seen = new Set<string>();
  const purchased: GooglePlayPurchaseRecord[] = [];
  const pendingProducts = new Set<string>();
  for (const purchase of synced.purchases) {
    if (!isAllowedProductId(purchase.productId)) continue;
    if (purchase.state === "pending") {
      pendingProducts.add(purchase.productId);
      continue;
    }
    const key = `${purchase.productId}\u0000${purchase.purchaseToken}`;
    if (seen.has(key)) continue;
    seen.add(key);
    purchased.push(purchase);
  }
  const pending = resolvePendingFromProducts(pendingProducts);

  // Verification failures (other than missing configuration) must not erase cached grants.
  const verifyResults = await Promise.all(
    purchased.map(async (purchase): Promise<ProductOutcome> => {
      try {
        await deps.verifyPurchase({ productId: purchase.productId, purchaseToken: purchase.purchaseToken });
        return "verified";
      } catch (error) {
        if (error instanceof BillingConfigError) throw error;
        return error instanceof BillingRejectedError ? "rejected" : "unavailable";
      }
    }),
  );

  const outcomes: Record<string, ProductOutcome> = {};
  const productOutcome = (index: number) => verifyResults[index];
  purchased.forEach((purchase, index) => {
    // If the same product has several tokens, any verified one wins over a transient failure.
    const previous = outcomes[purchase.productId];
    const next = productOutcome(index);
    if (previous === "verified" || (previous === "unavailable" && next === "rejected")) return;
    outcomes[purchase.productId] = next;
  });

  let server: ServerEntitlements | null = null;
  if (Object.values(outcomes).includes("verified")) {
    try {
      server = await deps.fetchEntitlements();
    } catch (error) {
      if (error instanceof BillingConfigError) throw error;
      if (!(error instanceof BillingTransientError) && !(error instanceof BillingRejectedError)) throw error;
      server = null;
    }
  }

  const granted = emptyMap();
  for (const [productId, outcome] of Object.entries(outcomes)) {
    const covered = resolveEntitlementsFromOwnedProducts([productId]);
    const editions = EDITION_KEYS.filter((key) => covered[key]);

    if (outcome === "verified" && server) {
      if (editions.every((key) => server!.entitlements[key])) {
        editions.forEach((key) => { granted[key] = true; });
      }
    } else if (outcome === "unavailable" || (outcome === "verified" && !server)) {
      // Could not confirm right now: retain only what was verified earlier.
      editions.forEach((key) => { if (cached[key]) granted[key] = true; });
    }
    // "rejected": no grant, and cached grants for this product are not retained.
  }

  const finalOutcomes: Record<string, ProductOutcome> = { ...outcomes };
  for (const [productId, outcome] of Object.entries(outcomes)) {
    if (outcome === "verified" && !server) finalOutcomes[productId] = "unavailable";
    else if (outcome === "verified") {
      const covered = resolveEntitlementsFromOwnedProducts([productId]);
      const ok = EDITION_KEYS.filter((key) => covered[key]).every((key) => server!.entitlements[key]);
      if (!ok) finalOutcomes[productId] = "rejected";
    }
  }

  return { entitlements: granted, pending, authoritative: true, outcomes: finalOutcomes };
}
