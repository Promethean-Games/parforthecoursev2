import type { EditionId } from "@/lib/editions";

const STORAGE_KEY = "digitalEditionEntitlements";
const TEST_ACCESS_STORAGE_KEY = "digitalEditionTestAccess";
// Temporary Play Store QA unlock. Remove after tester access is no longer needed.
export const TEST_ACCESS_CODE = "PLAYTEST";

type EntitlementMap = Record<EditionId, boolean>;

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
  return readEntitlements();
}

export async function hasDigitalAccess(editionId: EditionId): Promise<boolean> {
  const entitlements = readEntitlements();
  return Boolean(entitlements[editionId]);
}

export async function purchaseDigitalEdition(editionId: EditionId): Promise<void> {
  const entitlements = readEntitlements();
  entitlements[editionId] = true;
  writeEntitlements(entitlements);
}

export async function setMockDigitalAccess(editionId: EditionId, unlocked: boolean): Promise<void> {
  const entitlements = readEntitlements();
  entitlements[editionId] = unlocked;
  writeEntitlements(entitlements);
}
