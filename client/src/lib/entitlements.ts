import type { EditionId } from "@/lib/editions";
import { apiRequest } from "@/lib/queryClient";
import { getBillingDeviceId } from "@/lib/billingDevice";

const STORAGE_KEY = "digitalEditionEntitlements";
const TEST_ACCESS_STORAGE_KEY = "digitalEditionTestAccess";
// Temporary Play Store QA unlock. Remove after tester access is no longer needed.
export const TEST_ACCESS_CODE = "PLAYTEST";

type EntitlementMap = Record<EditionId, boolean>;
export type PurchaseTarget = EditionId | "all";

const EMPTY_ENTITLEMENTS: EntitlementMap = {
  classic: false,
  reracked: false,
  sequential: false,
  "teed-off": false,
  tournament: false,
};

function hasTestingAccess(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TEST_ACCESS_STORAGE_KEY) === "true";
}

function readEntitlements(): EntitlementMap {
  if (typeof window === "undefined") return { ...EMPTY_ENTITLEMENTS };
  const raw = localStorage.getItem(STORAGE_KEY);
  const baseEntitlements: EntitlementMap = raw
    ? (() => {
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
      })()
    : { ...EMPTY_ENTITLEMENTS };

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

function writeEntitlements(value: EntitlementMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function setTestingAccess(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TEST_ACCESS_STORAGE_KEY, enabled ? "true" : "false");
  if (enabled) {
    writeEntitlements({
      classic: true,
      reracked: true,
      sequential: true,
      "teed-off": true,
      tournament: true,
    });
  }
}

export async function unlockAllTestEntitlements(code: string): Promise<boolean> {
  if (code.trim().toUpperCase() !== TEST_ACCESS_CODE) {
    return false;
  }

  setTestingAccess(true);
  return true;
}

export async function getDigitalEntitlements(): Promise<EntitlementMap> {
  if (hasTestingAccess()) {
    return readEntitlements();
  }

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

export async function hasDigitalAccess(editionId: EditionId): Promise<boolean> {
  const entitlements = await getDigitalEntitlements();
  return Boolean(entitlements[editionId]);
}

export async function purchaseDigitalEdition(target: PurchaseTarget): Promise<void> {
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
