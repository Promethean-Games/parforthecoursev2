export type EditionId = "classic" | "reracked" | "sequential" | "teed-off" | "tournament";

export const APPLE_BUNDLE_ID = "com.parforthecourse.app";

export const APPLE_EDITION_PRODUCT_IDS: Record<EditionId, string> = {
  classic: "com.parforthecourse.app.edition.classic",
  reracked: "com.parforthecourse.app.edition.reracked",
  sequential: "com.parforthecourse.app.edition.sequential",
  tournament: "com.parforthecourse.app.edition.tournament",
  "teed-off": "com.parforthecourse.app.edition.teedoff",
};

export const APPLE_BUNDLE_PRODUCT_ID = "com.parforthecourse.app.edition.bundle";

export const ALLOWED_APPLE_PRODUCT_IDS: ReadonlySet<string> = new Set([
  ...Object.values(APPLE_EDITION_PRODUCT_IDS),
  APPLE_BUNDLE_PRODUCT_ID,
]);

export function appleGrantForProduct(productId: string): EditionId | "all" | null {
  if (productId === APPLE_BUNDLE_PRODUCT_ID) return "all";
  const match = (Object.entries(APPLE_EDITION_PRODUCT_IDS) as [EditionId, string][])
    .find(([, appleProductId]) => appleProductId === productId);
  return match?.[0] ?? null;
}
