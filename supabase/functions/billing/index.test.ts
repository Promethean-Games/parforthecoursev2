// Mocked tests for the billing Edge Function. No network, no real credentials:
// Google and Supabase are mocked and the service-account key is generated in-process.
// Run from this directory with an npm-capable Deno: `deno test --allow-read --allow-env index.test.ts`
import assert from "node:assert/strict";

const OLD_PROVISIONAL_IDS = [
  "classic.digital",
  "reracked.digital",
  "sequential.digital",
  "teed_off.digital",
  "tournament.digital",
  "pftc_premium_unlock",
  "google_play_product_teed_off",
  "google_play_product_bundle_all",
];

const CONFIRMED = {
  classic: "google_play_product_classic",
  reracked: "google_play_product_reracked",
  sequential: "google_play_product_sequential",
  tournament: "google_play_product_tournament",
  "teed-off": "google_play_product_teedoff",
  bundle: "google_play_product_bundle",
};

const keyPair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
let binary = "";
for (const b of pkcs8) binary += String.fromCharCode(b);
const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(binary).replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;

const TEST_PACKAGE = "com.example.test"; // placeholder only; the real value is verified in Play Console
Deno.env.set("SUPABASE_URL", "https://fake.supabase.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake-service-role");
Deno.env.set("GOOGLE_PLAY_PACKAGE_NAME", TEST_PACKAGE);
Deno.env.set(
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  JSON.stringify({ client_email: "sa@x.iam.gserviceaccount.com", private_key: pem, token_uri: "https://oauth2.fake.test/token" }),
);

let handler!: (req: Request) => Promise<Response>;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: (req: Request) => Promise<Response>) => {
  handler = h;
  return {};
};

const state = {
  playCalls: [] as string[],
  acks: 0,
  rpcs: [] as { name: string; args: Record<string, unknown> }[],
  purchaseState: 0,
  acknowledgeState: 0,
};

function reset() {
  state.playCalls = [];
  state.acks = 0;
  state.rpcs = [];
  state.purchaseState = 0;
  state.acknowledgeState = 0;
}

const entRow = (o: Record<string, unknown> = {}) => ({
  device_id: "d1",
  trial_ends_at: new Date(Date.now() + 5 * 864e5).toISOString(),
  is_purchased: false,
  unlock_all_digital: false,
  edition_entitlements: { classic: true },
  ...o,
});

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const u = new URL(url);
  if (u.hostname === "oauth2.fake.test") {
    const jwt = new URLSearchParams(String(init?.body)).get("assertion")!.split(".");
    const sig = Uint8Array.from(atob(jwt[2].replace(/-/g, "+").replace(/_/g, "/") + "=="), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", keyPair.publicKey, sig, new TextEncoder().encode(`${jwt[0]}.${jwt[1]}`));
    return ok ? Response.json({ access_token: "tok", expires_in: 3600 }) : new Response("bad signature", { status: 400 });
  }
  if (u.hostname === "androidpublisher.googleapis.com") {
    state.playCalls.push(u.pathname);
    if (u.pathname.endsWith(":acknowledge")) {
      state.acks++;
      return Response.json({});
    }
    return Response.json({ purchaseState: state.purchaseState, acknowledgeState: state.acknowledgeState });
  }
  if (u.hostname === "fake.supabase.test") {
    const name = u.pathname.split("/").pop()!;
    state.rpcs.push({ name, args: JSON.parse(String(init?.body ?? "{}")) });
    return Response.json(entRow(name === "billing_record_play_verification" ? { is_purchased: state.purchaseState === 0 } : {}));
  }
  throw new Error(`unexpected fetch ${url}`);
};

const mod = await import("./index.ts");
const base = "https://fake.supabase.test/functions/v1/billing";
const verify = (body: unknown) => handler(new Request(`${base}/google-play/verify`, { method: "POST", body: JSON.stringify(body) }));

Deno.test("exports the exact six confirmed product IDs and nothing else", () => {
  assert.deepEqual(mod.EDITION_PRODUCT_IDS, {
    classic: CONFIRMED.classic,
    reracked: CONFIRMED.reracked,
    sequential: CONFIRMED.sequential,
    "teed-off": CONFIRMED["teed-off"],
    tournament: CONFIRMED.tournament,
  });
  assert.equal(mod.BUNDLE_PRODUCT_ID, CONFIRMED.bundle);
  assert.deepEqual([...mod.ALLOWED_PRODUCT_IDS].sort(), Object.values(CONFIRMED).sort());
  for (const old of OLD_PROVISIONAL_IDS) assert.ok(!mod.ALLOWED_PRODUCT_IDS.has(old), `${old} must not be allowed`);
});

Deno.test("digital-catalog returns confirmed IDs, bundle id and unlock-all mapping", async () => {
  const r = await handler(new Request(`${base}/google-play/digital-catalog`));
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(j.editionProducts, mod.EDITION_PRODUCT_IDS);
  assert.equal(j.bundleProductId, CONFIRMED.bundle);
  assert.equal(j.logicalEntitlements.bundle_all_editions, "all");
  assert.equal(j.logicalEntitlements.edition_teed_off, "teed-off");
  const text = JSON.stringify(j);
  for (const old of OLD_PROVISIONAL_IDS) assert.ok(!text.includes(old), `${old} leaked into catalog`);
});

Deno.test("config contract uses the mandatory package name and the bundle product", async () => {
  const r = await handler(new Request(`${base}/google-play/config`));
  assert.deepEqual(await r.json(), { packageName: TEST_PACKAGE, productId: CONFIRMED.bundle });
});

Deno.test("package name is mandatory: config and verify fail closed when unset", async () => {
  reset();
  Deno.env.delete("GOOGLE_PLAY_PACKAGE_NAME");
  try {
    const c = await handler(new Request(`${base}/google-play/config`));
    assert.equal(c.status, 500);
    const v = await verify({ deviceId: "d1", purchaseToken: "t", productId: CONFIRMED.classic });
    assert.equal(v.status, 500);
    assert.equal(state.playCalls.length, 0, "must not call Google without a configured package");
  } finally {
    Deno.env.set("GOOGLE_PLAY_PACKAGE_NAME", TEST_PACKAGE);
  }
});

Deno.test("verify accepts each confirmed product and passes the exact ID to Google and the DB", async () => {
  for (const productId of Object.values(CONFIRMED)) {
    reset();
    const r = await verify({ deviceId: "d1", purchaseToken: "tok-1", productId, packageName: TEST_PACKAGE });
    assert.equal(r.status, 200, productId);
    assert.ok(state.playCalls[0].includes(`/products/${productId}/tokens/`), "Google receives exact product id");
    const rpc = state.rpcs.find((x) => x.name === "billing_record_play_verification")!;
    assert.equal(rpc.args.p_product_id, productId);
    assert.equal(rpc.args.p_package_name, TEST_PACKAGE);
    assert.equal(rpc.args.p_purchase_state, 0);
  }
});

Deno.test("verify defaults to the bundle product when productId is omitted", async () => {
  reset();
  await verify({ deviceId: "d1", purchaseToken: "tok-2" });
  const rpc = state.rpcs.find((x) => x.name === "billing_record_play_verification")!;
  assert.equal(rpc.args.p_product_id, CONFIRMED.bundle);
});

Deno.test("verify rejects every old provisional product ID before contacting Google", async () => {
  for (const productId of [...OLD_PROVISIONAL_IDS, "some.other.product", "bundle_all_editions"]) {
    reset();
    const r = await verify({ deviceId: "d1", purchaseToken: "tok-3", productId });
    assert.equal(r.status, 400, productId);
    assert.deepEqual(await r.json(), { error: "Unsupported productId" });
    assert.equal(state.playCalls.length, 0);
    assert.equal(state.rpcs.length, 0);
  }
});

Deno.test("verify rejects a client-supplied package name that differs from the configured one", async () => {
  reset();
  const r = await verify({ deviceId: "d1", purchaseToken: "t", productId: CONFIRMED.classic, packageName: "com.attacker.app" });
  assert.equal(r.status, 400);
  assert.equal(state.playCalls.length, 0);
});

Deno.test("verify validates the body and enforces length limits", async () => {
  assert.equal((await verify({})).status, 400);
  assert.equal((await verify({ deviceId: "x".repeat(201), purchaseToken: "t" })).status, 400);
  assert.equal((await verify({ deviceId: "d", purchaseToken: "t".repeat(4097) })).status, 400);
  assert.equal((await handler(new Request(`${base}/google-play/verify`, { method: "POST", body: "not json" }))).status, 400);
});

Deno.test("purchase states: acknowledge when unacknowledged, pending is not purchased", async () => {
  reset();
  await verify({ deviceId: "d1", purchaseToken: "tok-4", productId: CONFIRMED.classic });
  assert.equal(state.acks, 1, "unacknowledged purchase is acknowledged");

  reset();
  state.acknowledgeState = 1;
  await verify({ deviceId: "d1", purchaseToken: "tok-5", productId: CONFIRMED.classic });
  assert.equal(state.acks, 0, "already acknowledged purchase is not re-acknowledged");

  reset();
  state.purchaseState = 2;
  const r = await verify({ deviceId: "d1", purchaseToken: "tok-6", productId: CONFIRMED.classic });
  assert.equal((await r.json()).isPurchased, false);
  assert.equal(state.acks, 0, "pending purchases are never acknowledged");
  assert.equal(state.rpcs[0].args.p_purchase_state, 2);
});

Deno.test("status / digital-entitlements contracts and deviceId requirement", async () => {
  assert.equal((await handler(new Request(`${base}/google-play/status`))).status, 400);
  const s = await (await handler(new Request(`${base}/google-play/status?deviceId=d1`))).json();
  assert.deepEqual(Object.keys(s).sort(), ["checkedAt", "daysLeftInTrial", "hasAccess", "isPurchased", "message", "trialActive", "trialEndsAt"]);
  assert.equal(s.daysLeftInTrial, 5);
  const d = await (await handler(new Request(`${base}/digital-entitlements?deviceId=d1`))).json();
  assert.deepEqual(Object.keys(d).sort(), ["entitlements", "unlockAll"]);
  assert.equal(d.entitlements.classic, true);
  assert.equal(d.entitlements.reracked, false);
});

Deno.test("CORS: WebView origin allowed, unknown origin blocked, 404 for unknown route", async () => {
  const ok = await handler(new Request(`${base}/google-play/digital-catalog`, { headers: { Origin: "https://appassets.androidplatform.net" } }));
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://appassets.androidplatform.net");
  const bad = await handler(new Request(`${base}/google-play/digital-catalog`, { headers: { Origin: "https://evil.example" } }));
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
  assert.equal((await handler(new Request(base + "/x", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }))).status, 403);
  assert.equal((await handler(new Request(base + "/x", { method: "OPTIONS", headers: { Origin: "https://appassets.androidplatform.net" } }))).status, 204);
  assert.equal((await handler(new Request(`${base}/nope`))).status, 404);
});

Deno.test("migration SQL carries exactly the confirmed IDs and no old IDs", async () => {
  const sql = await Deno.readTextFile(new URL("../../migrations/20261016163811_billing_entitlements.sql", import.meta.url));
  for (const id of Object.values(CONFIRMED)) assert.ok(sql.includes(`'${id}'`), `${id} missing from SQL`);
  for (const old of OLD_PROVISIONAL_IDS) assert.ok(!sql.includes(old), `${old} must not appear in SQL`);
});
