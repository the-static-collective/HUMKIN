import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPocket, validatePocket, makeLivingGift, appendGift, attachAsset,
  reviewPorch, reviewUse, eligibleForLocalUse, withdrawGift, recheckImportedPocket,
  makeLocalPreview, makeMusicInfluence, MAX_ASSET_BYTES
} from "../living-relic.contributions.mjs";
import { deriveConsequences } from "../living-relic.core.mjs";

const relic = "field-001";
let eventNumber = 0;
const nextId = () => "event-" + String(++eventNumber).padStart(4, "0");
const at = "2026-11-18T12:00:00.000Z";
function gift(overrides = {}) {
  return makeLivingGift({
    id: "gift-one", relicId: relic, channelId: "channel-one", ancestorId: null,
    kind: "statement", title: "The soup helped", attribution: "",
    note: "I received a little food and heard a little song.",
    rightsRef: "demo-local-release-001", offeredUses: [],
    createdAt: at, ...overrides
  });
}
const review = (g, decision, by = "local-demo") =>
  reviewPorch(g, { id: nextId(), decision, by, at });
const allow = (g, use, decision = "admit", releaseCheck = "local reviewer inspected release") =>
  reviewUse(g, { id: nextId(), use, decision, by: "local-demo", at, releaseCheck });
function witnessed() {
  const doc = JSON.parse(readFileSync(new URL("../relics/field-001.json", import.meta.url), "utf8"));
  return deriveConsequences(doc, doc.demonstration_confirmation_id);
}

test("KINSHIP-007: offering a contribution grants zero permissions by default", () => {
  const g = gift();
  assert.equal(g.attribution, "Anonymous");
  assert.deepEqual(g.offeredUses, []);
  assert.equal(makeLocalPreview(g, "relic"), null);
  assert.equal(makeLocalPreview(g, "music"), null);
  assert.throws(() => gift({ offeredUses: ["publish-everything"] }), /unknown/);
  assert.throws(() => gift({ note: "x".repeat(2001) }), /too long/);
});

test("KINSHIP-004: receive != welcome != admit; scoped uses are independent", () => {
  const g = gift({ offeredUses: ["relic", "music"] });
  assert.equal(eligibleForLocalUse(g, "relic"), false);
  assert.throws(() => allow(g, "relic"), /Porch/);
  review(g, "welcome");
  assert.equal(eligibleForLocalUse(g, "relic"), false);
  assert.throws(() => allow(g, "radio"), /did not offer/);
  assert.throws(() => allow(g, "relic", "admit", ""), /release/);
  allow(g, "relic");
  assert.equal(eligibleForLocalUse(g, "relic"), true);
  assert.equal(eligibleForLocalUse(g, "music"), false);
  assert.equal(eligibleForLocalUse(g, "radio"), false);
  assert.equal(makeLocalPreview(g, "relic").published, false);
  allow(g, "relic", "hold");
  assert.equal(eligibleForLocalUse(g, "relic"), false);
  allow(g, "music");
  assert.equal(eligibleForLocalUse(g, "music"), true);
  review(g, "refuse");
  assert.equal(eligibleForLocalUse(g, "music"), false);
  review(g, "welcome");
  assert.equal(eligibleForLocalUse(g, "music"), false, "new Porch welcome cannot resurrect old use approvals");
  allow(g, "music");
  assert.equal(eligibleForLocalUse(g, "music"), true);
});

test("KINSHIP-007 media hashes bind exact bytes; reattaching different media fails", () => {
  const g = gift({ kind: "audio", note: "Voice letter", offeredUses: ["relic", "music"] });
  review(g, "welcome");
  assert.throws(() => allow(g, "music"), /media/);
  assert.throws(() => attachAsset(g, { sha256: "x", mime: "audio/webm", size: 5 }), /asset/);
  assert.throws(() => attachAsset(g, { sha256: "a".repeat(64), mime: "image/svg+xml", size: 5 }), /asset/);
  assert.throws(() => attachAsset(g, { sha256: "a".repeat(64), mime: "audio/webm", size: MAX_ASSET_BYTES + 1 }), /asset/);
  attachAsset(g, { sha256: "a".repeat(64), mime: "audio/webm", size: 5 });
  assert.throws(() => attachAsset(g, { sha256: "b".repeat(64), mime: "audio/webm", size: 5 }), /changed bytes/);
  allow(g, "music");
  assert.equal(eligibleForLocalUse(g, "music"), true);
  assert.equal(eligibleForLocalUse(g, "relic"), false);
});

test("KINSHIP-004 handoff: import preserves history but imports no editorial authority", () => {
  const pocket = createPocket(relic);
  const g = appendGift(pocket, gift({ offeredUses: ["relic", "music"] }));
  review(g, "welcome");
  allow(g, "music");
  assert.equal(eligibleForLocalUse(g, "music"), true);
  const imported = recheckImportedPocket(JSON.parse(JSON.stringify(pocket)), relic);
  assert.deepEqual(imported.gifts[0].history, g.history, "historic events are still visible");
  assert.equal(eligibleForLocalUse(imported.gifts[0], "music"), false);
  assert.throws(() => recheckImportedPocket(imported, "other-relic"), /another relic/);
  assert.throws(() => allow(imported.gifts[0], "music"), /Porch/);
  review(imported.gifts[0], "welcome");
  allow(imported.gifts[0], "music");
  assert.equal(eligibleForLocalUse(imported.gifts[0], "music"), true, "new human local review explicitly required");
});

test("Media import requires exact local reattachment AND fresh scoped release review", () => {
  const pocket = createPocket(relic);
  const g = appendGift(pocket, gift({ kind: "audio", note: "Letter", offeredUses: ["music"] }));
  attachAsset(g, { sha256: "a".repeat(64), mime: "audio/ogg", size: 40 });
  review(g, "welcome");
  allow(g, "music");
  const imported = recheckImportedPocket(pocket, relic).gifts[0];
  assert.equal(imported.needsReattach, true);
  assert.equal(eligibleForLocalUse(imported, "music"), false);
  review(imported, "welcome");
  assert.throws(() => allow(imported, "music"), /exact media/);
  assert.throws(() => attachAsset(imported, { sha256: "b".repeat(64), mime: "audio/ogg", size: 40 }), /changed bytes/);
  attachAsset(imported, { sha256: "a".repeat(64), mime: "audio/ogg", size: 40 });
  assert.equal(eligibleForLocalUse(imported, "music"), false);
  allow(imported, "music");
  assert.equal(eligibleForLocalUse(imported, "music"), true);
});

test("Withdrawal stops all new uses, masks previews, and blocks inherited offspring", () => {
  const pocket = createPocket(relic);
  const g = appendGift(pocket, gift({ offeredUses: ["relic", "music", "radio"] }));
  review(g, "welcome");
  allow(g, "relic");
  allow(g, "music");
  allow(g, "radio");
  assert.equal(makeLocalPreview(g, "relic")?.note, g.note);
  assert.equal(eligibleForLocalUse(g, "radio"), true);
  const music = makeMusicInfluence(g, witnessed());
  assert.equal(music.status, "HELD_NOT_ON_AIR");
  assert.equal(music.publicPermissionGranted, false);
  assert.equal(music.sourceMediaIncluded, false);
  withdrawGift(g, { id: nextId(), by: "local-demo", at, reason: "request" });
  assert.equal(makeLocalPreview(g, "relic"), null);
  assert.equal(makeMusicInfluence(g, witnessed()), null);
  assert.equal(eligibleForLocalUse(g, "radio"), false);
  assert.throws(() => review(g, "welcome"), /withdrawn/);
  assert.throws(() => appendGift(pocket, gift({
    id: "gift-child", ancestorId: "gift-one", note: "Derivative"
  })), /ancestor unavailable/);
  assert.equal(g.history.at(-1).type, "withdraw");
  assert.equal(g.history.length, 5, "history carries the withdrawal record");
});

test("Lineage references must be explicit; no silent ancestor permissions", () => {
  const pocket = createPocket(relic);
  const parent = appendGift(pocket, gift({ offeredUses: ["relic"] }));
  const child = appendGift(pocket, gift({
    id: "gift-two", ancestorId: parent.id, channelId: "channel-two",
    note: "Separate person's words", offeredUses: []
  }));
  assert.equal(child.ancestorId, parent.id);
  assert.equal(eligibleForLocalUse(child, "relic"), false);
  assert.equal(eligibleForLocalUse(child, "music"), false);
  assert.throws(() => appendGift(pocket, gift({
    id: "gift-three", ancestorId: "unknown-gift"
  })), /ancestor unavailable/);
  assert.equal(validatePocket(pocket), pocket);
});

test("Adversarial imports fail closed: extra authority fields, duplicate IDs, forged media, cycles", () => {
  const p = createPocket(relic);
  appendGift(p, gift());
  assert.throws(() => recheckImportedPocket({ ...p, autoPublish: true }, relic), /invalid pocket/);
  assert.throws(() => recheckImportedPocket({ ...p, gifts: [p.gifts[0], p.gifts[0]] }, relic), /duplicate gift/);
  assert.throws(() => recheckImportedPocket({
    ...p, gifts: [{ ...p.gifts[0], approved: true }]
  }, relic), /invalid gift/);
  assert.throws(() => recheckImportedPocket({
    ...p, gifts: [{ ...p.gifts[0], ancestorId: "gift-one" }]
  }, relic), /invalid ancestor/);
  assert.throws(() => recheckImportedPocket({
    ...p, gifts: [{ ...p.gifts[0], asset: { sha256: "a".repeat(64), mime: "audio/webm", size: 4 } }]
  }, relic), /unsupported|statement/);
});

test("A genuine musical influence requires scoped local review and synthetic gift confirmation", () => {
  const base = witnessed();
  const g = gift({ offeredUses: ["music"] });
  assert.equal(makeMusicInfluence(g, base), null);
  review(g, "welcome");
  allow(g, "music");
  const first = makeMusicInfluence(g, base);
  assert.equal(first.notes.length, base.music.midi_notes.length);
  assert.deepEqual(first, makeMusicInfluence(structuredClone(g), structuredClone(base)));
  assert.throws(() => makeMusicInfluence(g, { accepted: true, mode: "live" }), /synthetic/);
  const afterImport = recheckImportedPocket({
    ...createPocket(relic), gifts: [g]
  }, relic);
  assert.equal(makeMusicInfluence(afterImport.gifts[0], base), null);
});

test("Browser wiring is zero-upload and separately holds Kinship-derived proposals", () => {
  const html = readFileSync(new URL("../living-relic.html", import.meta.url), "utf8");
  const js = readFileSync(new URL("../living-relic.porch.js", import.meta.url), "utf8");
  assert.match(html, /living-relic\.porch\.js/);
  for (const id of ["gift-title", "gift-kind", "gift-offer", "gift-list", "gift-review",
    "gift-porch-welcome", "gift-use-admit", "gift-withdraw", "gift-export", "gift-import"]) {
    assert.match(html, new RegExp('id="' + id + '"'), "missing " + id);
  }
  assert.match(html, /NO UPLOAD/);
  assert.match(js, /crypto\.subtle\.digest/);
  assert.doesNotMatch(js, /\.method\s*=\s*["']POST/);
  assert.doesNotMatch(js, /\bfetch\s*\([^)]*,\s*\{[^}]*method\s*:\s*["']POST/s);
  assert.doesNotMatch(html, /<audio[^>]*autoplay/);
});
