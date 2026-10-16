import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EDITION_RULESET_IDS,
  MERCY_RULE_TEXT,
  RULESETS,
  RULES_EDITION_ORDER,
  getEditionRules,
  rulesetToText,
} from "./edition-rules";
import { EDITIONS } from "../lib/editions";
import { RULES_CLOSED, closeRules, openRules, selectRulesEdition } from "../lib/rules-session";

const ALL = ["classic", "reracked", "sequential", "tournament", "teed-off"] as const;
const text = (id: string) => rulesetToText(getEditionRules(id).ruleset);

test("all five editions exist and match the edition catalog", () => {
  assert.deepEqual([...RULES_EDITION_ORDER].sort(), [...ALL].sort());
  for (const e of EDITIONS) assert.ok(EDITION_RULESET_IDS[e.id], e.id);
  assert.equal(getEditionRules("teed-off").editionName, "Tee'd Off");
});

test("classic, reracked and tee'd off share one ruleset; others are independent", () => {
  const base = getEditionRules("classic").ruleset;
  assert.equal(getEditionRules("reracked").ruleset, base);
  assert.equal(getEditionRules("teed-off").ruleset, base);
  assert.equal(getEditionRules("sequential").ruleset, RULESETS.sequential);
  assert.equal(getEditionRules("tournament").ruleset, RULESETS.tournament);
  assert.notEqual(RULESETS.sequential, base);
  assert.notEqual(RULESETS.tournament, base);
  assert.equal(getEditionRules("reracked").editionName, "Reracked");
});

test("Mercy Rule is in full rules and quick reference of every edition", () => {
  for (const id of ALL) {
    const { ruleset } = getEditionRules(id);
    assert.ok(text(id).includes(MERCY_RULE_TEXT), id);
    assert.ok(ruleset.quickReference.some((i) => i.label === "Mercy Rule" && i.text === MERCY_RULE_TEXT), id);
  }
});

test("edition-specific rules do not leak between rulesets", () => {
  for (const id of ["sequential", "tournament"]) {
    assert.ok(!/stripes before/i.test(text(id)), id);
    assert.ok(!/out-of-turn contact/i.test(text(id)), id);
  }
  assert.ok(/lowest-numbered/.test(text("sequential")));
  assert.ok(!/lowest-numbered/.test(text("tournament")));
  for (const id of ["classic", "reracked", "teed-off"]) {
    assert.ok(!/lowest-numbered/.test(text(id)), id);
    assert.ok(/stripes before pocketing solids/.test(text(id)), id);
  }
});

test("tournament rules include digital scoring, 18 holes, rotation, tee box", () => {
  const t = text("tournament");
  for (const s of ["Digital Scoring", "all 18 holes", "Table Rotation", "Tee Box Violation", "null score"]) {
    assert.ok(t.includes(s), s);
  }
});

test("missing or unknown (legacy) edition ids fall back without throwing", () => {
  for (const v of [undefined, null, "", "bogus"]) assert.equal(getEditionRules(v).editionId, "classic");
});

test("locked editions: rules lookup needs no entitlement, opening never changes edition", () => {
  const t = openRules(RULES_CLOSED, { editionId: "tournament" });
  assert.deepEqual(t.state, { view: "edition", editionId: "tournament", fromPicker: false, fromGame: false });
  assert.equal(t.save, false);
});

test("splash picker -> edition -> back -> close", () => {
  let t = openRules(RULES_CLOSED, {});
  assert.equal(t.state.view, "picker");
  t = selectRulesEdition(t.state, "sequential");
  assert.equal(t.state.view === "edition" && t.state.editionId, "sequential");
  t = closeRules(t.state);
  assert.equal(t.state.view, "picker");
  t = closeRules(t.state);
  assert.equal(t.state.view, "closed");
  assert.equal(t.save, false);
});

test("game rules: one save on open, one separate save on close, repeats ignored", () => {
  const opened = openRules(RULES_CLOSED, { editionId: "classic", fromGame: true });
  assert.equal(opened.save, true);
  const again = openRules(opened.state, { editionId: "sequential", fromGame: true });
  assert.equal(again.save, false);
  assert.equal(again.state, opened.state);
  const closed = closeRules(opened.state);
  assert.equal(closed.save, true);
  assert.equal(closed.state.view, "closed");
  assert.equal(closeRules(closed.state).save, false);
});
