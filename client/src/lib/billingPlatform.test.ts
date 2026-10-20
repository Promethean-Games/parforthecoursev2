import test from "node:test";
import assert from "node:assert/strict";
import { resolveBillingPlatform } from "./billingPlatform";

test("iOS production stays iOS when the StoreKit bridge is present", () => {
  assert.equal(resolveBillingPlatform(true, true, false), "ios");
});

test("iOS production stays iOS when the StoreKit bridge is absent", () => {
  assert.equal(resolveBillingPlatform(true, false, false), "ios");
});

test("Android with its billing bridge remains Android", () => {
  assert.equal(resolveBillingPlatform(false, false, true), "android");
});

test("ordinary web without an explicit iOS setting keeps web behavior", () => {
  assert.equal(resolveBillingPlatform(false, false, false), "web");
});

test("explicit iOS production setting takes precedence over other bridge signals", () => {
  assert.equal(resolveBillingPlatform(true, false, true), "ios");
});
