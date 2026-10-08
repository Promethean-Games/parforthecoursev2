import type { EditionId } from "@/lib/editions";

const STORAGE_KEY = "digitalEditionEntitlements";

type EntitlementMap = Record<EditionId, boolean>;

const EMPTY_ENTITLEMENTS: EntitlementMap = {
  classic: false,
  reracked: false,
  sequential: false,
  "teed-off": false,
  tournament: false,
};

function readEntitlements(): EntitlementMap {
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

function writeEntitlements(value: EntitlementMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
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
