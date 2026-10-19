import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BillingConfigError,
  BillingRejectedError,
  BillingTransientError,
  createBillingApi,
  resolveBillingApiConfig,
} from "./billing-api";
import { classifyRestore, reconcileVerifiedPurchases, type VerificationDeps, type VerificationResult } from "./play-verification";
import { parsePurchaseRecords, type GooglePlayPurchaseRecord, type GooglePlaySyncResult } from "./googlePlayBilling";
import { BUNDLE_PRODUCT_ID, EDITION_PRODUCT_IDS, resolveEntitlementsFromOwnedProducts, type EntitlementMap } from "./play-products";

const NONE: EntitlementMap = { classic: false, reracked: false, sequential: false, "teed-off": false, tournament: false };
const ALL: EntitlementMap = { classic: true, reracked: true, sequential: true, "teed-off": true, tournament: true };
const CONFIG = { baseUrl: "https://example.supabase.co/functions/v1/billing", anonKey: "public-anon-key" };

function purchase(productId: string, token = `tok-${productId}`, state: "purchased" | "pending" = "purchased"): GooglePlayPurchaseRecord {
  return { productId, purchaseToken: token, state, acknowledged: false };
}

function syncOf(...purchases: GooglePlayPurchaseRecord[]): GooglePlaySyncResult {
  return {
    authoritative: true,
    purchases,
    ownedProductIds: purchases.filter((p) => p.state === "purchased").map((p) => p.productId),
    pendingProductIds: purchases.filter((p) => p.state === "pending").map((p) => p.productId),
  };
}

// In-memory stand-in for the Edge Function: verifies tokens (mocked Google), binds a token to
// one device, and reports per-device entitlements.
class FakeServer {
  googleState = new Map<string, number>(); // token -> 0 purchased, 1 cancelled, 2 pending
  tokenOwner = new Map<string, { deviceId: string; productId: string }>();
  calls: Array<{ path: string; body?: Record<string, string>; headers: Record<string, string> }> = [];
  failNext = 0;
  failStatus = 0; // 0 = network error

  fetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const path = url.replace(CONFIG.baseUrl, "");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    this.calls.push({ path, body, headers: init?.headers as Record<string, string> });
    if (this.failNext > 0) {
      this.failNext -= 1;
      if (this.failStatus === 0) throw new TypeError("network down");
      return new Response("{}", { status: this.failStatus });
    }
    if (path === "/google-play/verify") {
      const { deviceId, productId, purchaseToken } = body;
      if (!productId.startsWith("google_play_product_")) return new Response("{}", { status: 400 });
      const state = this.googleState.get(purchaseToken);
      if (state === undefined) return new Response("{}", { status: 500 });
      if (state === 0) this.tokenOwner.set(purchaseToken, { deviceId, productId }); // rebind to latest device
      return new Response(JSON.stringify({ hasAccess: true }), { status: 200 });
    }
    if (path.startsWith("/digital-entitlements")) {
      const deviceId = new URL(url).searchParams.get("deviceId");
      const owned = [...this.tokenOwner.values()].filter((o) => o.deviceId === deviceId).map((o) => o.productId);
      const entitlements = resolveEntitlementsFromOwnedProducts(owned);
      return new Response(JSON.stringify({ unlockAll: owned.includes(BUNDLE_PRODUCT_ID), entitlements }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  };
}

function setup(server: FakeServer, sync: GooglePlaySyncResult | Error, cached: EntitlementMap = NONE, deviceId = "device-A") {
  const api = createBillingApi(CONFIG, {
    fetch: server.fetch,
    getDeviceId: () => deviceId,
    sleep: async () => {},
  });
  const deps: VerificationDeps = {
    sync: async () => { if (sync instanceof Error) throw sync; return sync; },
    verifyPurchase: (p) => api.verifyPurchase(p),
    fetchEntitlements: () => api.fetchEntitlements(),
    readCached: () => ({ ...cached }),
  };
  return { api, deps };
}

test("individual edition verification grants only that edition", async () => {
  const server = new FakeServer();
  server.googleState.set("tok-r", 0);
  const { deps } = setup(server, syncOf(purchase(EDITION_PRODUCT_IDS.reracked, "tok-r")));
  const result = await reconcileVerifiedPurchases(deps);
  assert.deepEqual(result.entitlements, { ...NONE, reracked: true });
  assert.equal(result.outcomes[EDITION_PRODUCT_IDS.reracked], "verified");
});

test("bundle verification grants all five editions", async () => {
  const server = new FakeServer();
  server.googleState.set("tok-b", 0);
  const { deps } = setup(server, syncOf(purchase(BUNDLE_PRODUCT_ID, "tok-b")));
  assert.deepEqual((await reconcileVerifiedPurchases(deps)).entitlements, ALL);
});

test("no entitlement is granted before verification succeeds", async () => {
  const server = new FakeServer();
  let resolveVerify: () => void = () => {};
  const gate = new Promise<void>((resolve) => { resolveVerify = resolve; });
  const { deps } = setup(server, syncOf(purchase(BUNDLE_PRODUCT_ID, "tok-b")));
  let granted = false;
  const pendingRun = reconcileVerifiedPurchases({
    ...deps,
    verifyPurchase: async () => { await gate; throw new BillingRejectedError("no", 400); },
  }).then((r) => { granted = Object.values(r.entitlements).some(Boolean); });
  assert.equal(server.calls.length, 0);
  assert.equal(granted, false);
  resolveVerify();
  await pendingRun;
  assert.equal(granted, false);
});

test("a device-reported purchase the server does not confirm grants nothing", async () => {
  const server = new FakeServer();
  server.googleState.set("tok-c", 1); // Google says cancelled: server verifies but does not bind
  const { deps } = setup(server, syncOf(purchase(EDITION_PRODUCT_IDS.classic, "tok-c")));
  const result = await reconcileVerifiedPurchases(deps);
  assert.deepEqual(result.entitlements, NONE);
  assert.equal(result.outcomes[EDITION_PRODUCT_IDS.classic], "rejected");
});

test("pending purchases are never verified or unlocked, but are flagged pending", async () => {
  const server = new FakeServer();
  const { deps } = setup(server, syncOf(purchase(EDITION_PRODUCT_IDS.tournament, "tok-p", "pending")));
  const result = await reconcileVerifiedPurchases(deps);
  assert.deepEqual(result.entitlements, NONE);
  assert.equal(result.pending.tournament, true);
  assert.equal(server.calls.length, 0);
});

test("invalid purchase rejected by the server (4xx) grants nothing", async () => {
  const server = new FakeServer();
  server.failNext = 1;
  server.failStatus = 400;
  const { deps } = setup(server, syncOf(purchase(BUNDLE_PRODUCT_ID, "tok-x")));
  const result = await reconcileVerifiedPurchases(deps);
  assert.deepEqual(result.entitlements, NONE);
  assert.equal(result.outcomes[BUNDLE_PRODUCT_ID], "rejected");
  assert.equal(server.calls.length, 1); // 4xx is not retried
});

test("obsolete or unknown product IDs are rejected client-side and never sent", async () => {
  const server = new FakeServer();
  const { api, deps } = setup(server, syncOf(purchase("pftc_premium_unlock", "tok-old"), purchase("com.prometheangames.pftc.classic", "tok-old2")));
  await assert.rejects(api.verifyPurchase({ productId: "pftc_premium_unlock", purchaseToken: "t" }), BillingRejectedError);
  const result = await reconcileVerifiedPurchases(deps);
  assert.deepEqual(result.entitlements, NONE);
  assert.equal(server.calls.length, 0);
  assert.deepEqual(parsePurchaseRecords([{ productId: "x", purchaseToken: "", state: "purchased" }, { productId: "x", purchaseToken: "t", state: "bogus" }, null]), []);
});

test("network failures retry with backoff, then succeed", async () => {
  const server = new FakeServer();
  server.googleState.set("tok-s", 0);
  server.failNext = 2;
  server.failStatus = 0;
  const { deps } = setup(server, syncOf(purchase(EDITION_PRODUCT_IDS.sequential, "tok-s")));
  const result = await reconcileVerifiedPurchases(deps);
  assert.equal(result.entitlements.sequential, true);
  assert.equal(server.calls.filter((c) => c.path === "/google-play/verify").length, 3);
});

test("5xx and 429 are transient; persistent outage leaves purchase unverified", async () => {
  for (const status of [500, 503, 429]) {
    const server = new FakeServer();
    server.googleState.set("tok", 0);
    server.failNext = 10;
    server.failStatus = status;
    const { deps } = setup(server, syncOf(purchase(EDITION_PRODUCT_IDS.classic, "tok")));
    const result = await reconcileVerifiedPurchases(deps);
    assert.deepEqual(result.entitlements, NONE, `status ${status}`);
    assert.equal(result.outcomes[EDITION_PRODUCT_IDS.classic], "unavailable");
    assert.equal(server.calls.length, 3); // initial try + 2 retries
  }
});

test("previously verified cached entitlements survive a temporary network failure", async () => {
  const server = new FakeServer();
  server.googleState.set("tok-b", 0);
  server.failNext = 10;
  server.failStatus = 0;
  const { deps } = setup(server, syncOf(purchase(BUNDLE_PRODUCT_ID, "tok-b")), ALL);
  const result = await reconcileVerifiedPurchases(deps);
  assert.deepEqual(result.entitlements, ALL);
  assert.equal(result.outcomes[BUNDLE_PRODUCT_ID], "unavailable");
});

test("cache is retained per product on failure but never extends beyond what was verified", async () => {
  const server = new FakeServer();
  server.failNext = 10;
  server.failStatus = 0;
  const cached = { ...NONE, classic: true };
  // Owns classic (cached) and reracked (never verified): only classic stays.
  const { deps } = setup(server, syncOf(purchase(EDITION_PRODUCT_IDS.classic, "a"), purchase(EDITION_PRODUCT_IDS.reracked, "b")), cached);
  assert.deepEqual((await reconcileVerifiedPurchases(deps)).entitlements, { ...NONE, classic: true });
});

test("when Play itself is unavailable or non-authoritative, cached state is untouched", async () => {
  const server = new FakeServer();
  const down = await reconcileVerifiedPurchases(setup(server, new Error("bridge"), ALL).deps);
  assert.equal(down.authoritative, false);
  assert.deepEqual(down.entitlements, ALL);
  const soft = await reconcileVerifiedPurchases(setup(server, { ...syncOf(), authoritative: false }, ALL).deps);
  assert.equal(soft.authoritative, false);
  assert.deepEqual(soft.entitlements, ALL);
  assert.equal(server.calls.length, 0);
});

test("when Play authoritatively reports no purchase, stale cached grants are dropped", async () => {
  const server = new FakeServer();
  const result = await reconcileVerifiedPurchases(setup(server, syncOf(), ALL).deps);
  assert.equal(result.authoritative, true);
  assert.deepEqual(result.entitlements, NONE);
});

test("duplicate tokens are verified once; repeated runs are idempotent", async () => {
  const server = new FakeServer();
  server.googleState.set("tok-b", 0);
  const sync = syncOf(purchase(BUNDLE_PRODUCT_ID, "tok-b"), purchase(BUNDLE_PRODUCT_ID, "tok-b"));
  const { deps } = setup(server, sync);
  const first = await reconcileVerifiedPurchases(deps);
  const second = await reconcileVerifiedPurchases(deps);
  assert.deepEqual(first.entitlements, ALL);
  assert.deepEqual(second.entitlements, first.entitlements);
  assert.equal(server.calls.filter((c) => c.path === "/google-play/verify").length, 2); // once per run
});

test("restoration on a new device ID re-verifies the same token for that device", async () => {
  const server = new FakeServer();
  server.googleState.set("tok-b", 0);
  const sync = syncOf(purchase(BUNDLE_PRODUCT_ID, "tok-b"));
  await reconcileVerifiedPurchases(setup(server, sync, NONE, "device-A").deps);
  const restored = await reconcileVerifiedPurchases(setup(server, sync, NONE, "device-B-after-reinstall").deps);
  assert.deepEqual(restored.entitlements, ALL);
  const verifyCalls = server.calls.filter((c) => c.path === "/google-play/verify");
  assert.equal(verifyCalls[1].body?.deviceId, "device-B-after-reinstall");
  // The server moved the token: the old device no longer has the grant.
  const { api } = setup(server, syncOf(), NONE, "device-A");
  assert.deepEqual((await api.fetchEntitlements()).entitlements, NONE);
});

test("requests carry the device id, product id, token and public key; never a package name", async () => {
  const server = new FakeServer();
  server.googleState.set("tok-t", 0);
  const { api } = setup(server, syncOf(), NONE, "dev-1");
  await api.verifyPurchase({ productId: EDITION_PRODUCT_IDS["teed-off"], purchaseToken: "tok-t" });
  const call = server.calls[0];
  assert.deepEqual(call.body, { deviceId: "dev-1", productId: "google_play_product_teedoff", purchaseToken: "tok-t" });
  assert.equal(call.headers.apikey, "public-anon-key");
  assert.equal(call.headers.Authorization, "Bearer public-anon-key");
  assert.equal("packageName" in (call.body ?? {}), false);
});

test("error messages never contain the purchase token", async () => {
  const server = new FakeServer();
  server.failNext = 10;
  server.failStatus = 400;
  const { api } = setup(server, syncOf());
  await assert.rejects(api.verifyPurchase({ productId: BUNDLE_PRODUCT_ID, purchaseToken: "SECRET-TOKEN" }), (e: Error) => !e.message.includes("SECRET-TOKEN"));
  server.failNext = 10;
  server.failStatus = 0;
  await assert.rejects(api.verifyPurchase({ productId: BUNDLE_PRODUCT_ID, purchaseToken: "SECRET-TOKEN" }), (e: Error) => e instanceof BillingTransientError && !e.message.includes("SECRET-TOKEN"));
});

test("billing API URL and key must be configured; https is required", async () => {
  assert.throws(() => resolveBillingApiConfig({}), BillingConfigError);
  assert.throws(() => resolveBillingApiConfig({ VITE_BILLING_API_URL: "https://x.co" }), /ANON_KEY/);
  assert.throws(() => resolveBillingApiConfig({ VITE_SUPABASE_ANON_KEY: "k" }), /BILLING_API_URL/);
  assert.throws(() => resolveBillingApiConfig({ VITE_BILLING_API_URL: "http://x.co", VITE_SUPABASE_ANON_KEY: "k" }), /https/);
  assert.equal(resolveBillingApiConfig({ VITE_BILLING_API_URL: "https://x.co/functions/v1/billing/", VITE_SUPABASE_ANON_KEY: "k" }).baseUrl, "https://x.co/functions/v1/billing");
});

test("missing configuration surfaces as a config error with a purchase to verify", async () => {
  const deps: VerificationDeps = {
    sync: async () => syncOf(purchase(BUNDLE_PRODUCT_ID, "tok-b")),
    verifyPurchase: async () => { resolveBillingApiConfig({}); },
    fetchEntitlements: async () => ({ unlockAll: false, entitlements: NONE }),
    readCached: () => ({ ...ALL }),
  };
  await assert.rejects(reconcileVerifiedPurchases(deps), BillingConfigError);
});

test("native bridge: single acknowledger, token never logged; backend acknowledges only PURCHASED", () => {
  const kt = readFileSync("android/app/src/main/java/com/parforthecourse/app/PlayBillingBridge.kt", "utf8");
  assert.equal(/acknowledgePurchase\s*\(/.test(kt), false, "bridge must not acknowledge; backend does after verification");
  assert.equal(/Log\.\w\([^)]*(purchaseToken|token)/i.test(kt.replace(/\s+/g, " ")), false);
  assert.match(kt, /\.put\("purchaseToken"/);
  const fn = readFileSync("supabase/functions/billing/index.ts", "utf8");
  assert.match(fn, /if \(purchaseState === 0\) \{\s*const acknowledgeState/);
  for (const file of ["billing-api.ts", "play-verification.ts", "entitlements.ts", "googlePlayBilling.ts"]) {
    const src = readFileSync(`client/src/lib/${file}`, "utf8");
    assert.equal(/console\.\w+\([^)]*[tT]oken/.test(src), false, `${file} must not log tokens`);
    assert.equal(/(localStorage|sessionStorage)\.setItem\([^)]*[tT]oken/.test(src), false, `${file} must not persist tokens`);
  }
});

test("classifyRestore summarises reconciliation without granting anything", () => {
  const base: VerificationResult = { entitlements: NONE, pending: NONE, authoritative: true, outcomes: {} };
  assert.equal(classifyRestore({ ...base, authoritative: false }), "unavailable");
  assert.equal(classifyRestore(base), "none");
  assert.equal(classifyRestore({ ...base, outcomes: { [EDITION_PRODUCT_IDS.classic]: "verified" } }), "restored");
  assert.equal(classifyRestore({ ...base, outcomes: { [EDITION_PRODUCT_IDS.classic]: "unavailable" } }), "unavailable");
  assert.equal(classifyRestore({ ...base, outcomes: { [EDITION_PRODUCT_IDS.classic]: "rejected" } }), "rejected");
  assert.equal(classifyRestore({ ...base, outcomes: { a: "rejected", b: "verified" } }), "restored");
});

test("restore of an already-owned purchase verifies server-side and grants only after verification", async () => {
  const server = new FakeServer();
  server.googleState.set("tok-classic", 0);
  const { deps } = setup(server, syncOf(purchase(EDITION_PRODUCT_IDS.classic, "tok-classic")));
  const result = await reconcileVerifiedPurchases(deps);
  assert.equal(classifyRestore(result), "restored");
  assert.equal(result.entitlements.classic, true);
  assert.ok(server.calls.some((c) => c.path === "/google-play/verify"));
});
