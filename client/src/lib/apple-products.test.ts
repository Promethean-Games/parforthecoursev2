import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ALLOWED_APPLE_PRODUCT_IDS,
  APPLE_BUNDLE_PRODUCT_ID,
  APPLE_EDITION_PRODUCT_IDS,
  appleGrantForProduct,
} from "./apple-products";
import type { EditionId } from "./editions";

const EXPECTED: Record<EditionId, string> = {
  classic: "com.parforthecourse.app.edition.classic",
  reracked: "com.parforthecourse.app.edition.reracked",
  sequential: "com.parforthecourse.app.edition.sequential",
  tournament: "com.parforthecourse.app.edition.tournament",
  "teed-off": "com.parforthecourse.app.edition.teedoff",
};
const EXPECTED_BUNDLE = "com.parforthecourse.app.edition.bundle";

test("Apple product IDs match the approved catalog exactly", () => {
  assert.deepEqual(APPLE_EDITION_PRODUCT_IDS, EXPECTED);
  assert.equal(APPLE_BUNDLE_PRODUCT_ID, EXPECTED_BUNDLE);
  assert.deepEqual(
    [...ALLOWED_APPLE_PRODUCT_IDS].sort(),
    [...Object.values(EXPECTED), EXPECTED_BUNDLE].sort(),
  );
  assert.equal(new Set(ALLOWED_APPLE_PRODUCT_IDS).size, 6);
});

test("Apple products map to their editions and bundle maps to all editions", () => {
  for (const [edition, productId] of Object.entries(EXPECTED) as [EditionId, string][]) {
    assert.equal(appleGrantForProduct(productId), edition);
  }
  assert.equal(appleGrantForProduct(EXPECTED_BUNDLE), "all");
  assert.equal(appleGrantForProduct("google_play_product_classic"), null);
  assert.equal(appleGrantForProduct("unknown"), null);
});

test("client, Edge Function and migration use the same Apple identifiers", () => {
  const edge = readFileSync("supabase/functions/billing/apple-products.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20261020000000_apple_billing.sql", "utf8");
  for (const productId of [...Object.values(EXPECTED), EXPECTED_BUNDLE]) {
    assert.ok(edge.includes(productId), `Edge Function missing ${productId}`);
    assert.ok(migration.includes(productId), `migration missing ${productId}`);
  }
  assert.ok(migration.includes("when 'com.parforthecourse.app.edition.bundle'     then 'all'"));
  assert.ok(edge.includes('if (productId === APPLE_BUNDLE_PRODUCT_ID) return "all"'));
});
