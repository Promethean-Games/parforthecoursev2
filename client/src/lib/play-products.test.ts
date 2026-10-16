import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALLOWED_PRODUCT_IDS,
  BUNDLE_PRODUCT_ID,
  EDITION_PRODUCT_IDS,
  buildGooglePlayCatalog,
  isAllowedProductId,
  normalizeCatalog,
  productIdForTarget,
  resolveEntitlementsFromOwnedProducts,
  resolvePendingFromProducts,
} from "./play-products";
import { EDITIONS, type EditionId } from "./editions";

const CONFIRMED: Record<EditionId, string> = {
  classic: "google_play_product_classic",
  reracked: "google_play_product_reracked",
  sequential: "google_play_product_sequential",
  tournament: "google_play_product_tournament",
  "teed-off": "google_play_product_teedoff",
};
const CONFIRMED_BUNDLE = "google_play_product_bundle";

const OBSOLETE_IDS = [
  "classic.digital",
  "reracked.digital",
  "sequential.digital",
  "teed_off.digital",
  "tournament.digital",
  "pftc_premium_unlock",
  "google_play_product_teed_off",
  "google_play_product_bundle_all",
  "bundle_all_editions",
  "classic",
  "reracked",
  "sequential",
  "teed-off",
  "tournament",
];

const EDITION_IDS = Object.keys(CONFIRMED) as EditionId[];
const NONE = { classic: false, reracked: false, sequential: false, "teed-off": false, tournament: false };

test("the six confirmed product IDs are exact and nothing else is allowed", () => {
  assert.deepEqual(EDITION_PRODUCT_IDS, CONFIRMED);
  assert.equal(BUNDLE_PRODUCT_ID, CONFIRMED_BUNDLE);
  assert.deepEqual([...ALLOWED_PRODUCT_IDS].sort(), [...Object.values(CONFIRMED), CONFIRMED_BUNDLE].sort());
  OBSOLETE_IDS.forEach((id) => assert.equal(isAllowedProductId(id), false, `${id} must be rejected`));
  Object.values(CONFIRMED).concat(CONFIRMED_BUNDLE).forEach((id) => assert.equal(isAllowedProductId(id), true));
});

test("internal edition IDs are unchanged and distinct from Play product IDs", () => {
  assert.deepEqual(new Set(EDITIONS.map((e) => e.id)), new Set(EDITION_IDS));
  EDITIONS.forEach((e) => {
    assert.equal(e.digitalProductId, CONFIRMED[e.id], `${e.id} digitalProductId`);
    assert.notEqual(e.digitalProductId, e.id);
  });
});

test("catalog maps each edition to its product and the bundle to unlock-all", () => {
  const catalog = buildGooglePlayCatalog();
  assert.deepEqual(catalog.editionProducts, CONFIRMED);
  assert.equal(catalog.bundleProductId, CONFIRMED_BUNDLE);
  assert.equal(catalog.logicalEntitlements.bundle_all_editions, "all");
  assert.equal(catalog.logicalEntitlements.edition_teed_off, "teed-off");
  assert.equal(productIdForTarget("all"), CONFIRMED_BUNDLE);
  EDITION_IDS.forEach((id) => assert.equal(productIdForTarget(id), CONFIRMED[id]));
});

test("normalizeCatalog discards obsolete, cached and server-supplied IDs", () => {
  const stale = {
    editionProducts: {
      classic: "classic.digital",
      reracked: "reracked.digital",
      sequential: "sequential.digital",
      "teed-off": "teed_off.digital",
      tournament: "tournament.digital",
    },
    bundleProductId: "bundle_all_editions",
  };
  assert.deepEqual(normalizeCatalog(stale), buildGooglePlayCatalog());
  assert.deepEqual(normalizeCatalog(null), buildGooglePlayCatalog());
  assert.deepEqual(normalizeCatalog({ bundleProductId: null }), buildGooglePlayCatalog());
});

test("each individual product grants only its own edition", () => {
  EDITION_IDS.forEach((id) => {
    const result = resolveEntitlementsFromOwnedProducts([CONFIRMED[id]]);
    assert.deepEqual(result, { ...NONE, [id]: true }, id);
  });
  assert.deepEqual(resolveEntitlementsFromOwnedProducts([CONFIRMED.classic, CONFIRMED["teed-off"]]), {
    ...NONE,
    classic: true,
    "teed-off": true,
  });
});

test("the bundle unlocks every edition and wins over individual products", () => {
  const all = { classic: true, reracked: true, sequential: true, "teed-off": true, tournament: true };
  assert.deepEqual(resolveEntitlementsFromOwnedProducts([CONFIRMED_BUNDLE]), all);
  assert.deepEqual(resolveEntitlementsFromOwnedProducts([CONFIRMED_BUNDLE, CONFIRMED.classic]), all);
});

test("obsolete or unknown owned IDs never grant entitlements", () => {
  assert.deepEqual(resolveEntitlementsFromOwnedProducts(OBSOLETE_IDS), NONE);
  assert.deepEqual(resolveEntitlementsFromOwnedProducts([]), NONE);
});

test("pending purchases use the confirmed IDs; a pending bundle marks every edition", () => {
  EDITION_IDS.forEach((id) => assert.deepEqual(resolvePendingFromProducts([CONFIRMED[id]]), { ...NONE, [id]: true }, id));
  assert.deepEqual(resolvePendingFromProducts([CONFIRMED_BUNDLE]), {
    classic: true,
    reracked: true,
    sequential: true,
    "teed-off": true,
    tournament: true,
  });
  assert.deepEqual(resolvePendingFromProducts(OBSOLETE_IDS), NONE);
});

test("client sources and the native bridge carry no obsolete product IDs", () => {
  const files = [
    "client/src/lib/play-products.ts",
    "client/src/lib/editions.ts",
    "client/src/lib/entitlements.ts",
    "android/app/src/main/java/com/parforthecourse/app/PlayBillingBridge.kt",
  ];
  const obsolete = ["classic.digital", "reracked.digital", "sequential.digital", "teed_off.digital", "tournament.digital", "pftc_premium_unlock", "google_play_product_teed_off", "google_play_product_bundle_all", '"bundle_all_editions"'];
  files.forEach((file) => {
    const text = readFileSync(file, "utf8");
    obsolete.forEach((id) => {
      // "bundle_all_editions" is still the logical entitlement key, so only quoted string use as a product ID matters.
      if (id === '"bundle_all_editions"') return;
      assert.equal(text.includes(id), false, `${file} contains ${id}`);
    });
  });

  const kotlin = readFileSync(files[3], "utf8");
  [...Object.values(CONFIRMED), CONFIRMED_BUNDLE].forEach((id) =>
    assert.ok(kotlin.includes(`"${id}"`), `native bridge allowlist is missing ${id}`),
  );
});
