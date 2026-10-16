import type { EditionId } from "./editions";
import { isAllowedProductId, type EntitlementMap } from "./play-products";

// Client for the Supabase `billing` Edge Function. The anon/publishable key is a public client
// key (never the service-role key); the URL and key come from build-time env, not source.

export class BillingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingConfigError";
  }
}

// Network failure, timeout, 408/429/5xx: the purchase may well be valid, so retry later and
// keep any previously verified entitlements.
export class BillingTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingTransientError";
  }
}

// The server definitively refused the request (other 4xx). Never grants access.
export class BillingRejectedError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BillingRejectedError";
    this.status = status;
  }
}

export interface BillingApiConfig {
  baseUrl: string;
  anonKey: string;
}

export interface BillingEnv {
  VITE_BILLING_API_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export interface ServerEntitlements {
  unlockAll: boolean;
  entitlements: EntitlementMap;
}

export interface BillingApiDeps {
  fetch: typeof fetch;
  getDeviceId: () => string;
  sleep?: (ms: number) => Promise<void>;
  retryDelaysMs?: number[];
  timeoutMs?: number;
}

const DEFAULT_RETRY_DELAYS_MS = [500, 1500];
const DEFAULT_TIMEOUT_MS = 15_000;

export function resolveBillingApiConfig(env: BillingEnv | undefined): BillingApiConfig {
  const baseUrl = (env?.VITE_BILLING_API_URL ?? "").trim().replace(/\/+$/, "");
  const anonKey = (env?.VITE_SUPABASE_ANON_KEY ?? "").trim();

  if (!baseUrl) {
    throw new BillingConfigError(
      "Purchase verification is not configured (VITE_BILLING_API_URL is missing).",
    );
  }
  if (!anonKey) {
    throw new BillingConfigError(
      "Purchase verification is not configured (VITE_SUPABASE_ANON_KEY is missing).",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new BillingConfigError("VITE_BILLING_API_URL is not a valid URL.");
  }
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:")) {
    throw new BillingConfigError("VITE_BILLING_API_URL must use https.");
  }

  return { baseUrl, anonKey };
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function parseEntitlementMap(raw: unknown): EntitlementMap {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<EditionId, unknown>>;
  return {
    classic: source.classic === true,
    reracked: source.reracked === true,
    sequential: source.sequential === true,
    "teed-off": source["teed-off"] === true,
    tournament: source.tournament === true,
  };
}

export function createBillingApi(config: BillingApiConfig, deps: BillingApiDeps) {
  const sleep = deps.sleep ?? defaultSleep;
  const retryDelays = deps.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await deps.fetch(`${config.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
      });
    } catch {
      throw new BillingTransientError("Could not reach the billing service.");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Response bodies are not surfaced: they are not needed and must never echo tokens.
      if (isTransientStatus(response.status)) {
        throw new BillingTransientError(`Billing service unavailable (${response.status}).`);
      }
      throw new BillingRejectedError(`Billing request rejected (${response.status}).`, response.status);
    }

    try {
      return await response.json();
    } catch {
      throw new BillingTransientError("Billing service returned an unreadable response.");
    }
  }

  async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const delay = retryDelays[attempt];
        if (!(error instanceof BillingTransientError) || delay === undefined) throw error;
        await sleep(delay);
      }
    }
  }

  return {
    // Asks the server to verify the purchase with Google and bind the token to this device.
    // The response is deliberately not used to grant anything: grants come from fetchEntitlements().
    async verifyPurchase(input: { productId: string; purchaseToken: string }): Promise<void> {
      if (!isAllowedProductId(input.productId)) {
        throw new BillingRejectedError("Unsupported product ID.", 400);
      }
      if (!input.purchaseToken) {
        throw new BillingRejectedError("Missing purchase token.", 400);
      }
      const body = JSON.stringify({
        deviceId: deps.getDeviceId(),
        productId: input.productId,
        purchaseToken: input.purchaseToken,
      });
      await withRetry(() => request("/google-play/verify", { method: "POST", body }));
    },

    async fetchEntitlements(): Promise<ServerEntitlements> {
      const deviceId = encodeURIComponent(deps.getDeviceId());
      const data = await withRetry(() =>
        request(`/digital-entitlements?deviceId=${deviceId}`, { method: "GET" })
      ) as { unlockAll?: unknown; entitlements?: unknown };
      return {
        unlockAll: data?.unlockAll === true,
        entitlements: parseEntitlementMap(data?.entitlements),
      };
    },
  };
}

export type BillingApi = ReturnType<typeof createBillingApi>;
