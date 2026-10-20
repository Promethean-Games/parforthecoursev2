export interface AppleStoreProduct {
  productId: string;
  available: boolean;
  title: string;
  description: string;
  formattedPrice: string | null;
  priceCurrencyCode: string | null;
  priceAmountMicros: number | null;
}

export interface AppleTransactionRecord {
  productId: string;
  transactionId: string;
  signedTransaction: string;
  unfinished: boolean;
}

export type ApplePurchaseResult =
  | { status: "purchased"; transaction: AppleTransactionRecord }
  | { status: "pending" }
  | { status: "cancelled" };

type BridgeEventType = "catalog_result" | "purchase_result" | "sync_result" | "finish_result";
type BridgePayload = {
  ok: boolean;
  message?: string;
  status?: "purchased" | "pending" | "cancelled" | "failed";
  products?: AppleStoreProduct[];
  transactions?: unknown[];
  productId?: string;
  transactionId?: string;
  signedTransaction?: string;
  unfinished?: boolean;
};
interface BridgeEnvelope {
  type: string;
  requestId: string;
  payload: BridgePayload;
}

interface NativeMessageHandler {
  postMessage(message: string): void;
}

const EVENT_NAME = "pftc-ios-billing";
const REQUEST_TIMEOUT_MS = 30_000;

function requestId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `pftc-ios-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getHandler(): NativeMessageHandler | null {
  if (typeof window === "undefined") return null;
  return window.webkit?.messageHandlers?.PFTCiOSBilling as NativeMessageHandler | null ?? null;
}

function parseEnvelope(event: Event): BridgeEnvelope | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail = event.detail;
  if (!detail || typeof detail !== "object") return null;
  const value = detail as Partial<BridgeEnvelope>;
  if (typeof value.type !== "string" || typeof value.requestId !== "string" || !value.payload) return null;
  return value as BridgeEnvelope;
}

function request<T extends BridgeEventType>(
  type: T,
  action: string,
  values: Record<string, unknown> = {},
): Promise<BridgePayload> {
  if (typeof window === "undefined" || !getHandler()) {
    return Promise.reject(new Error("Apple StoreKit billing is unavailable on this device."));
  }

  return new Promise((resolve, reject) => {
    const id = requestId();
    const onEvent = (event: Event) => {
      const envelope = parseEnvelope(event);
      if (!envelope || envelope.type !== type || envelope.requestId !== id) return;
      cleanup();
      if (!envelope.payload.ok) {
        reject(new Error(envelope.payload.message || "Apple billing request failed."));
        return;
      }
      resolve(envelope.payload);
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apple billing request timed out."));
    }, REQUEST_TIMEOUT_MS);
    const cleanup = () => {
      window.removeEventListener(EVENT_NAME, onEvent);
      window.clearTimeout(timeout);
    };

    window.addEventListener(EVENT_NAME, onEvent);
    try {
      getHandler()?.postMessage(JSON.stringify({ action, requestId: id, ...values }));
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error("Apple billing request failed."));
    }
  });
}

export function isAppleStoreKitBillingSupported(): boolean {
  return getHandler() !== null;
}

export async function queryAppleStoreProducts(): Promise<AppleStoreProduct[]> {
  const payload = await request("catalog_result", "queryProducts");
  return Array.isArray(payload.products) ? payload.products as AppleStoreProduct[] : [];
}

export async function purchaseAppleStoreProduct(productId: string): Promise<ApplePurchaseResult> {
  const payload = await request("purchase_result", "purchase", { productId });
  if (payload.status === "pending" || payload.status === "cancelled") {
    return { status: payload.status };
  }
  if (
    payload.status !== "purchased" ||
    typeof payload.transactionId !== "string" ||
    typeof payload.signedTransaction !== "string"
  ) {
    throw new Error("App Store returned an incomplete transaction.");
  }
  return {
    status: "purchased",
    transaction: {
      productId,
      transactionId: payload.transactionId,
      signedTransaction: payload.signedTransaction,
      unfinished: payload.unfinished === true,
    },
  };
}

export async function syncAppleStoreTransactions(restore = false): Promise<AppleTransactionRecord[]> {
  const payload = await request("sync_result", "sync", { restore });
  return parseAppleTransactionRecords(payload.transactions);
}

export async function finishAppleStoreTransaction(transactionId: string): Promise<void> {
  await request("finish_result", "finish", { transactionId });
}

export function parseAppleTransactionRecords(raw: unknown): AppleTransactionRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    if (
      typeof value.productId !== "string" ||
      typeof value.transactionId !== "string" ||
      typeof value.signedTransaction !== "string" ||
      !value.signedTransaction
    ) {
      return [];
    }
    return [{
      productId: value.productId,
      transactionId: value.transactionId,
      signedTransaction: value.signedTransaction,
      unfinished: value.unfinished === true,
    }];
  });
}

export function listenForAppleTransactionUpdates(
  listener: (transaction: AppleTransactionRecord) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onEvent = (event: Event) => {
    const envelope = parseEnvelope(event);
    if (envelope?.type !== "transaction_update" || envelope.payload.status !== "purchased") return;
    const [transaction] = parseAppleTransactionRecords([{
      productId: envelope.payload.productId,
      transactionId: envelope.payload.transactionId,
      signedTransaction: envelope.payload.signedTransaction,
      unfinished: true,
    }]);
    if (transaction) listener(transaction);
  };
  window.addEventListener(EVENT_NAME, onEvent);
  return () => window.removeEventListener(EVENT_NAME, onEvent);
}
