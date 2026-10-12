type BridgeEventType = "catalog_result" | "purchase_result" | "sync_result";

interface BridgeEnvelope {
  type: BridgeEventType;
  requestId: string;
  timestamp: number;
  payload: {
    ok: boolean;
    message?: string;
    code?: number;
    status?: "purchased" | "pending" | "cancelled" | "failed";
    products?: Array<{
      productId: string;
      available: boolean;
      title: string;
      description: string;
      formattedPrice: string | null;
      priceCurrencyCode: string | null;
      priceAmountMicros: number | null;
    }>;
    purchasedProductIds?: string[];
    pendingProductIds?: string[];
    ownedProductIds?: string[];
    authoritative?: boolean;
    billingReady?: boolean;
  };
}

export interface GooglePlayCatalogProduct {
  productId: string;
  available: boolean;
  title: string;
  description: string;
  formattedPrice: string | null;
  priceCurrencyCode: string | null;
  priceAmountMicros: number | null;
}

// Legacy exports kept for compatibility with older billing UI paths.
export interface GooglePlayConfig {
  packageName: string;
  productId: string;
}

export interface GooglePlayAccessStatus {
  hasAccess: boolean;
  isPurchased: boolean;
  trialActive: boolean;
  trialEndsAt: string | null;
  daysLeftInTrial: number | null;
  message: string;
  checkedAt: string;
}

export interface GooglePlayPurchaseResult {
  status: "purchased" | "pending" | "cancelled";
  purchasedProductIds: string[];
  pendingProductIds: string[];
}

export interface GooglePlaySyncResult {
  authoritative: boolean;
  ownedProductIds: string[];
  pendingProductIds: string[];
}

const BILLING_EVENT_NAME = "pftc-play-billing";
const REQUEST_TIMEOUT_MS = 30000;

function getBridge() {
  if (typeof window === "undefined") return null;
  return window.AndroidPlayBilling ?? null;
}

function randomRequestId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `pftc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseEvent(raw: Event): BridgeEnvelope | null {
  if (!(raw instanceof CustomEvent)) return null;
  const detail = raw.detail;
  if (!detail || typeof detail !== "object") return null;
  const maybe = detail as Partial<BridgeEnvelope>;
  if (
    typeof maybe.type !== "string"
    || typeof maybe.requestId !== "string"
    || typeof maybe.timestamp !== "number"
    || !maybe.payload
  ) {
    return null;
  }
  return maybe as BridgeEnvelope;
}

function toErrorMessage(payload: BridgeEnvelope["payload"], fallback: string): string {
  if (payload.message && payload.message.trim().length > 0) {
    return payload.message;
  }
  return fallback;
}

function requestBridgeEvent<TPayload extends BridgeEnvelope["payload"]>(
  type: BridgeEventType,
  invoke: (requestId: string) => void,
): Promise<TPayload> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Play Billing bridge is unavailable outside the browser."));
  }

  return new Promise<TPayload>((resolve, reject) => {
    const requestId = randomRequestId();
    let resolved = false;

    const cleanup = () => {
      window.removeEventListener(BILLING_EVENT_NAME, onEvent as EventListener);
      window.clearTimeout(timeoutId);
    };

    const onEvent = (rawEvent: Event) => {
      const parsed = parseEvent(rawEvent);
      if (!parsed || parsed.type !== type || parsed.requestId !== requestId) {
        return;
      }

      cleanup();
      resolved = true;
      resolve(parsed.payload as TPayload);
    };

    const timeoutId = window.setTimeout(() => {
      if (resolved) return;
      cleanup();
      reject(new Error("Google Play Billing request timed out."));
    }, REQUEST_TIMEOUT_MS);

    window.addEventListener(BILLING_EVENT_NAME, onEvent as EventListener);

    try {
      invoke(requestId);
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error("Google Play Billing bridge request failed."));
    }
  });
}

export function isGooglePlayBillingSupported(): boolean {
  return getBridge() !== null;
}

export async function queryGooglePlayCatalog(productIds: string[]): Promise<GooglePlayCatalogProduct[]> {
  const bridge = getBridge();
  if (!bridge) {
    throw new Error("Google Play Billing bridge is unavailable on this device.");
  }

  const payload = await requestBridgeEvent("catalog_result", (requestId) => {
    bridge.queryCatalog(
      JSON.stringify({
        requestId,
        productIds,
      }),
    );
  });

  if (!payload.ok) {
    throw new Error(toErrorMessage(payload, "Failed to load Google Play product details."));
  }

  return Array.isArray(payload.products) ? payload.products : [];
}

export async function purchaseGooglePlayProduct(productId: string): Promise<GooglePlayPurchaseResult> {
  const bridge = getBridge();
  if (!bridge) {
    throw new Error("Google Play Billing bridge is unavailable on this device.");
  }

  const payload = await requestBridgeEvent("purchase_result", (requestId) => {
    bridge.launchPurchase(
      JSON.stringify({
        requestId,
        productId,
      }),
    );
  });

  const status = payload.status;
  if (status === "purchased" || status === "pending" || status === "cancelled") {
    return {
      status,
      purchasedProductIds: Array.isArray(payload.purchasedProductIds) ? payload.purchasedProductIds : [],
      pendingProductIds: Array.isArray(payload.pendingProductIds) ? payload.pendingProductIds : [],
    };
  }

  throw new Error(toErrorMessage(payload, "Google Play purchase failed."));
}

export async function syncGooglePlayPurchases(): Promise<GooglePlaySyncResult> {
  const bridge = getBridge();
  if (!bridge) {
    throw new Error("Google Play Billing bridge is unavailable on this device.");
  }

  const payload = await requestBridgeEvent("sync_result", (requestId) => {
    bridge.syncPurchases(JSON.stringify({ requestId }));
  });

  if (!payload.ok) {
    throw new Error(toErrorMessage(payload, "Failed to sync Google Play purchases."));
  }

  return {
    authoritative: Boolean(payload.authoritative),
    ownedProductIds: Array.isArray(payload.ownedProductIds) ? payload.ownedProductIds : [],
    pendingProductIds: Array.isArray(payload.pendingProductIds) ? payload.pendingProductIds : [],
  };
}

export async function startGooglePlayPurchase(config: GooglePlayConfig): Promise<string> {
  void config;
  throw new Error("Legacy token-based Google Play purchase flow is disabled. Use the Android billing bridge flow.");
}
