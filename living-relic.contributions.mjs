// HUMKIN RELAY 002 — adapted from Static Live KINSHIP-004 Porch and
// KINSHIP-007 Living Gifts (the-static-collective/static-live PR #33).
// One local, revocable contribution channel. No server, station or recipient authority.
export const POCKET_SCHEMA = "humkin/relay-pocket/v0.2";
export const GIFT_SCHEMA = "humkin/relay-living-gift/v0.2";
export const USES = Object.freeze(["relic", "music", "radio", "archive"]);
export const KINDS = Object.freeze(["statement", "audio", "photo", "video"]);
export const MIME_TYPES = Object.freeze({
  audio: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"],
  photo: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/webm"]
});
export const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const IDENT = /^[a-z0-9][a-z0-9-]{1,75}$/;
const HEX = /^[0-9a-f]{64}$/;
const STATES = ["welcome", "hold", "refuse"];
const REVIEW_STATES = ["admit", "hold", "refuse"];
function requireThat(condition, message) {
  if (!condition) throw new Error("Living Gifts: " + message);
}
function isRecord(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
function onlyKeys(value, allowed) {
  return isRecord(value) && Object.keys(value).every(key => allowed.includes(key));
}
function ident(value, label) {
  requireThat(typeof value === "string" && IDENT.test(value), "invalid " + label);
  return value;
}
function bounded(value, length, label, required = false) {
  requireThat(typeof value === "string", label + " must be text");
  const text = value.trim();
  requireThat(text.length <= length && (!required || text.length > 0), label + " missing or too long");
  return text;
}
function uses(value) {
  requireThat(Array.isArray(value) && value.length <= USES.length &&
    value.every(item => USES.includes(item)) && new Set(value).size === value.length, "unknown or duplicate proposed use");
  return value.slice();
}
function checkAsset(asset, kind) {
  if (asset === null) return;
  requireThat(onlyKeys(asset, ["sha256", "mime", "size"]) &&
    MIME_TYPES[kind]?.includes(asset.mime) && HEX.test(asset.sha256) &&
    Number.isSafeInteger(asset.size) && asset.size > 0 && asset.size <= MAX_ASSET_BYTES,
  "unsupported, oversized or invalid media asset");
}
function checkEvent(event) {
  requireThat(onlyKeys(event, ["id", "type", "at", "by", "decision", "use", "releaseCheck", "assetSha256", "reason"]) &&
    ident(event.id, "review ID") && typeof event.at === "string" && event.at.length <= 50 &&
    typeof event.by === "string" && event.by.length <= 100,
  "invalid review event");
  if (event.type === "porch") requireThat(STATES.includes(event.decision) && !("use" in event), "invalid Porch event");
  else if (event.type === "use") requireThat(USES.includes(event.use) && REVIEW_STATES.includes(event.decision) &&
    typeof event.releaseCheck === "string" && event.releaseCheck.length <= 200 &&
    (event.assetSha256 === null || (typeof event.assetSha256 === "string" && HEX.test(event.assetSha256))),
  "invalid use review");
  else if (event.type === "withdraw") requireThat(typeof event.reason === "string" && event.reason.length <= 200,
    "invalid withdrawal");
  else requireThat(false, "unknown event type");
}
export function validateGift(gift) {
  requireThat(onlyKeys(gift, ["schema", "id", "relicId", "channelId", "ancestorId", "createdAt",
    "kind", "title", "attribution", "note", "rightsRef", "offeredUses", "asset", "history",
    "trustedFrom", "needsReattach"]) && gift.schema === GIFT_SCHEMA, "invalid gift envelope");
  ident(gift.id, "gift ID");
  ident(gift.relicId, "relic ID");
  ident(gift.channelId, "channel ID");
  requireThat(gift.ancestorId === null || (ident(gift.ancestorId, "ancestor ID") !== gift.id),
    "invalid ancestor");
  requireThat(typeof gift.createdAt === "string" && gift.createdAt.length <= 50, "invalid creation time");
  requireThat(KINDS.includes(gift.kind), "unknown gift kind");
  bounded(gift.title, 120, "title", true);
  bounded(gift.attribution, 80, "attribution", true);
  bounded(gift.note, 2000, "note", gift.kind === "statement");
  bounded(gift.rightsRef, 160, "permission evidence reference");
  uses(gift.offeredUses);
  checkAsset(gift.asset, gift.kind);
  requireThat(gift.kind === "statement" ? gift.asset === null : true, "a statement cannot bind media");
  requireThat(Array.isArray(gift.history) && gift.history.length <= 100, "invalid history");
  requireThat(Number.isSafeInteger(gift.trustedFrom) && gift.trustedFrom >= 0 &&
    gift.trustedFrom <= gift.history.length && typeof gift.needsReattach === "boolean",
  "invalid local review boundary");
  const seen = new Set();
  let withdrawn = false;
  for (const event of gift.history) {
    checkEvent(event);
    requireThat(!seen.has(event.id), "duplicate event ID");
    requireThat(!withdrawn, "events cannot follow withdrawal");
    seen.add(event.id);
    if (event.type === "withdraw") withdrawn = true;
  }
  return gift;
}
export function createPocket(relicId) {
  ident(relicId, "relic ID");
  return { schema: POCKET_SCHEMA, relicId, gifts: [] };
}
export function validatePocket(pocket) {
  requireThat(onlyKeys(pocket, ["schema", "relicId", "gifts"]) &&
    pocket.schema === POCKET_SCHEMA && Array.isArray(pocket.gifts) &&
    pocket.gifts.length <= 50, "invalid pocket");
  ident(pocket.relicId, "relic ID");
  const ids = new Set();
  for (const gift of pocket.gifts) {
    validateGift(gift);
    requireThat(gift.relicId === pocket.relicId, "wrong relic");
    requireThat(!ids.has(gift.id), "duplicate gift ID");
    requireThat(gift.ancestorId === null || ids.has(gift.ancestorId), "unknown or future ancestor");
    ids.add(gift.id);
  }
  return pocket;
}
export function makeLivingGift({
  id, relicId, channelId, ancestorId = null, title, kind = "statement",
  attribution = "", note = "", rightsRef = "", offeredUses = [], createdAt
}) {
  const gift = {
    schema: GIFT_SCHEMA, id: ident(id, "gift ID"), relicId: ident(relicId, "relic ID"),
    channelId: ident(channelId, "channel ID"), ancestorId,
    createdAt: bounded(createdAt, 50, "creation time", true), kind,
    title: bounded(title, 120, "title", true), attribution: bounded(attribution, 80, "attribution") || "Anonymous",
    note: bounded(note, 2000, "note", kind === "statement"),
    rightsRef: bounded(rightsRef, 160, "permission evidence reference"),
    offeredUses: uses(offeredUses), asset: null, history: [], trustedFrom: 0, needsReattach: false
  };
  return validateGift(gift);
}
export function appendGift(pocket, gift) {
  validatePocket(pocket);
  validateGift(gift);
  requireThat(pocket.relicId === gift.relicId && !pocket.gifts.some(x => x.id === gift.id), "gift cannot be added");
  const ancestor = gift.ancestorId && pocket.gifts.find(x => x.id === gift.ancestorId);
  requireThat(!gift.ancestorId || (ancestor && !isWithdrawn(ancestor)), "ancestor unavailable or withdrawn");
  pocket.gifts.push(structuredClone(gift));
  return pocket.gifts.at(-1);
}
export function attachAsset(gift, media) {
  validateGift(gift);
  requireThat(!isWithdrawn(gift) && gift.kind !== "statement", "media cannot be attached");
  checkAsset(media, gift.kind);
  requireThat(media !== null, "media required");
  requireThat(!gift.asset || (gift.asset.sha256 === media.sha256 && gift.asset.mime === media.mime &&
    gift.asset.size === media.size), "changed bytes require a new gift and permissions");
  gift.asset = structuredClone(media);
  gift.needsReattach = false;
  return gift;
}
export function isWithdrawn(gift) {
  return gift.history.some(event => event.type === "withdraw");
}
function nextEvent(gift, event) {
  validateGift(gift);
  requireThat(!isWithdrawn(gift), "withdrawn contributions cannot be reused");
  requireThat(!gift.history.some(existing => existing.id === event.id), "duplicate review event");
  checkEvent(event);
  requireThat(gift.history.length < 100, "event history full");
  gift.history.push(event);
  return event;
}
export function reviewPorch(gift, { id, decision, by, at, reason = "" }) {
  requireThat(STATES.includes(decision), "unknown Porch disposition");
  return nextEvent(gift, {
    id: ident(id, "review ID"), type: "porch", decision,
    by: bounded(by, 100, "operator", true), at: bounded(at, 50, "review time", true),
    reason: bounded(reason, 200, "review note")
  });
}
function newest(gift, type, use) {
  for (let i = gift.history.length - 1; i >= gift.trustedFrom; i--) {
    const event = gift.history[i];
    if (event.type === type && (use === undefined || event.use === use)) return { event, index: i };
  }
  return null;
}
export function reviewUse(gift, { id, use, decision, by, at, releaseCheck = "" }) {
  validateGift(gift);
  requireThat(!isWithdrawn(gift) && USES.includes(use) && REVIEW_STATES.includes(decision), "invalid scoped review");
  const latest = newest(gift, "porch");
  if (decision === "admit") {
    requireThat(latest?.event.decision === "welcome", "Porch must welcome first");
    requireThat(gift.offeredUses.includes(use), "contributor did not offer this use");
    requireThat(gift.rightsRef && bounded(releaseCheck, 200, "release check", true),
      "an explicit release review is required");
    requireThat(gift.kind === "statement" ||
      (gift.asset && !gift.needsReattach), "exact media must be attached before review");
  }
  return nextEvent(gift, {
    id: ident(id, "review ID"), type: "use", use, decision,
    by: bounded(by, 100, "reviewer", true), at: bounded(at, 50, "review time", true),
    releaseCheck: bounded(releaseCheck, 200, "release check"),
    assetSha256: gift.asset?.sha256 || null
  });
}
export function eligibleForLocalUse(gift, use) {
  validateGift(gift);
  if (!USES.includes(use) || isWithdrawn(gift) || !gift.offeredUses.includes(use)) return false;
  if (gift.kind !== "statement" && (!gift.asset || gift.needsReattach)) return false;
  const porch = newest(gift, "porch");
  if (porch?.event.decision !== "welcome") return false;
  const review = newest(gift, "use", use);
  return !!(review && review.index > porch.index && review.event.decision === "admit" &&
    review.event.assetSha256 === (gift.asset?.sha256 || null));
}
export function withdrawGift(gift, { id, by, at, reason = "" }) {
  return nextEvent(gift, {
    id: ident(id, "review ID"), type: "withdraw",
    by: bounded(by, 100, "operator", true), at: bounded(at, 50, "withdrawal time", true),
    reason: bounded(reason, 200, "withdrawal note")
  });
}
export function recheckImportedPocket(payload, expectedRelicId) {
  // An exported snapshot is a *foreign statement*, not portable approval.
  // Re-review EVERY scope, re-welcome the Porch, and reattach identical bytes.
  const imported = structuredClone(validatePocket(payload));
  requireThat(imported.relicId === expectedRelicId, "cannot import another relic's pocket");
  for (const gift of imported.gifts) {
    gift.trustedFrom = gift.history.length;
    gift.needsReattach = !!gift.asset;
  }
  return imported;
}
export function makeLocalPreview(gift, use) {
  if (!eligibleForLocalUse(gift, use)) return null;
  return {
    schema: "humkin/relay-local-candidate/v0.2", sourceGiftId: gift.id,
    ancestorGiftId: gift.ancestorId, contributorChannel: gift.channelId,
    title: gift.title, attribution: gift.attribution, kind: gift.kind,
    note: gift.note, sourceAssetSha256: gift.asset?.sha256 || null,
    use, status: "HELD_LOCAL_REVIEW_ONLY", published: false, aired: false,
    disclosure: "not a public page, station approval, or license"
  };
}
function fingerprint(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function makeMusicInfluence(gift, base) {
  requireThat(base && base.accepted === true && base.mode === "SYNTHETIC_FIXTURE_ONLY" &&
    base.music?.status === "HELD_NOT_ON_AIR" && Array.isArray(base.music.midi_notes),
  "only a confirmed synthetic music candidate may be influenced here");
  if (!eligibleForLocalUse(gift, "music")) return null;
  // Music gets a *proposal-only* seed, not audio or the contributor's words.
  const seed = fingerprint(gift.id + "|" + gift.channelId + "|" + base.music.id);
  const offset = (seed % 5) - 2;
  return {
    schema: "humkin/relay-music-influence/v0.2", sourceGiftId: gift.id,
    ancestorGiftId: gift.ancestorId, seed: seed.toString(16).padStart(8, "0"),
    notes: base.music.midi_notes.map(n => n + offset),
    durations_seconds: base.music.durations_seconds.slice(),
    status: "HELD_NOT_ON_AIR", claimMode: "proposal-not-evidence",
    sourceMediaIncluded: false, publicPermissionGranted: false
  };
}
