// RELAY 002 browser-only workshop. Kinship 004 Porch + 007 Living Gifts inspired.
// Every "operator" act on this page is a LOCAL DEMONSTRATION, not authenticated approval.
import {
  createPocket, makeLivingGift, appendGift, attachAsset, reviewPorch, reviewUse,
  eligibleForLocalUse, withdrawGift, recheckImportedPocket, makeLocalPreview,
  makeMusicInfluence, MIME_TYPES, MAX_ASSET_BYTES, USES, isWithdrawn
} from "./living-relic.contributions.mjs";
import { validateRelic, deriveConsequences } from "./living-relic.core.mjs";

const $ = id => document.getElementById(id);
const relicId = new URL(location.href).searchParams.get("id") || "field-001";
const legitimateId = /^[a-z0-9][a-z0-9-]{1,63}$/.test(relicId);
const ownerChannel = "channel-" + crypto.randomUUID();
let pocket = legitimateId ? createPocket(relicId) : null;
let selectedId = "", proposedAudioContext = null, exportLink = null;
const now = () => new Date().toISOString();
const newId = prefix => prefix + "-" + crypto.randomUUID();
const say = message => { $("gift-status").textContent = message; };
const status = (id, message) => { $(id).textContent = message; };
function current() { return pocket?.gifts.find(g => g.id === selectedId) || null; }
function reviewActor() {
  const reviewer = $("gift-review").value.trim();
  if (!reviewer) throw new Error("Enter a local operator label before reviewing.");
  return reviewer;
}
async function hashMedia(file, kind) {
  if (!file || file.size < 1 || file.size > MAX_ASSET_BYTES)
    throw new Error("Choose a supported file no larger than 50 MB.");
  const mime = file.type.split(";")[0].toLowerCase();
  if (!MIME_TYPES[kind]?.includes(mime)) throw new Error("Unsupported media type for this gift.");
  if (!crypto.subtle?.digest) throw new Error("Secure-origin SHA-256 is required.");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return { sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join(""),
    mime, size: file.size };
}
function stopProposedAudio() {
  if (proposedAudioContext) proposedAudioContext.close().catch(() => {});
  proposedAudioContext = null;
}
function option(value, label) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = label;
  return el;
}
function updatePicker() {
  const parent = $("gift-ancestor");
  parent.replaceChildren(option("", "No ancestor — a new gift"));
  for (const gift of pocket.gifts) {
    if (!isWithdrawn(gift)) parent.append(option(gift.id, gift.title + " · " + gift.id.slice(0, 13)));
  }
  const picker = $("gift-list");
  picker.replaceChildren(option("", "Select a private contribution"));
  for (const gift of pocket.gifts) {
    const label = isWithdrawn(gift) ? "WITHDRAWN · " + gift.id.slice(0, 13) :
      gift.title + " · " + gift.id.slice(0, 13);
    picker.append(option(gift.id, label));
  }
  if (selectedId && pocket.gifts.some(g => g.id === selectedId)) picker.value = selectedId;
}
function render() {
  if (!pocket) return;
  updatePicker();
  const gift = current();
  if (!gift) {
    status("gift-detail", "Nothing has arrived. Create a contribution to demonstrate the Porch.");
    status("gift-preview", "No material eligible for a local relic preview.");
    status("gift-use-status", "HOLD · no contribution selected.");
    status("gift-music-status", "HELD · no consented musical influence.");
    $("gift-influence").disabled = true;
    return;
  }
  const latestPorch = gift.history.filter(e => e.type === "porch").at(-1)?.decision || "none";
  status("gift-detail",
    "CHANNEL: " + gift.channelId + "\n" +
    "GIFT: " + gift.id + "\n" +
    "ANCESTOR: " + (gift.ancestorId || "none") + "\n" +
    "FORM: " + gift.kind + "\n" +
    "ATTRIBUTION: " + gift.attribution + "\n" +
    "OFFERED USES: " + (gift.offeredUses.join(", ") || "none") + "\n" +
    "PORCH: " + latestPorch + "\n" +
    "REVIEWS: " + gift.history.length + "\n" +
    "MEDIA: " + (gift.asset?.sha256 || "none") +
    (gift.needsReattach ? " (reattach required)" : "") +
    (isWithdrawn(gift) ? "\nWITHDRAWN — new use prohibited" : ""));
  const preview = makeLocalPreview(gift, "relic");
  status("gift-preview", preview
    ? "HELD LOCAL RELIC PREVIEW\n" + preview.title + "\n" + preview.attribution + "\n" +
      (preview.note || "[media reference only; no bytes published]")
    : "HOLD · No current relic-specific local admission. Nothing was added to the published relic.");
  const selectedUse = $("gift-use").value;
  status("gift-use-status", eligibleForLocalUse(gift, selectedUse)
    ? "LOCALLY REVIEWED for " + selectedUse.toUpperCase() + " ONLY. Still not public, licensed or live."
    : "HOLD · No current local admission for " + selectedUse + ".");
  const music = eligibleForLocalUse(gift, "music") && !isWithdrawn(gift);
  $("gift-influence").disabled = !music || !$("fixture-confirmed").checked;
  if (!music) status("gift-music-status", "HELD · contributor music scope is not currently admitted.");
  if (!isWithdrawn(gift)) {
    status("gift-radio-status", makeLocalPreview(gift, "radio")
      ? "A HELD local radio DRAFT is possible. No station insertion, airtime or publishing."
      : "No current radio-consideration permission.");
  } else {
    status("gift-radio-status", "WITHDRAWN · no new radio proposal permitted.");
  }
}
async function createContribution() {
  if (!pocket) return;
  const kind = $("gift-kind").value;
  const offeredUses = [...document.querySelectorAll("[data-gift-use]:checked")].map(el => el.value);
  try {
    const gift = makeLivingGift({
      id: newId("gift"), relicId, channelId: ownerChannel,
      ancestorId: $("gift-ancestor").value || null,
      title: $("gift-title").value, kind, attribution: $("gift-attribution").value,
      note: $("gift-note").value, rightsRef: $("gift-rights").value,
      offeredUses, createdAt: now()
    });
    if (kind !== "statement") {
      const media = $("gift-media").files?.[0];
      const evidence = await hashMedia(media, kind);
      attachAsset(gift, evidence);
    }
    appendGift(pocket, gift);
    selectedId = gift.id;
    $("gift-title").value = "";
    $("gift-note").value = "";
    $("gift-media").value = "";
    $("gift-rights").value = "";
    document.querySelectorAll("[data-gift-use]").forEach(el => { el.checked = false; });
    render();
    say("RECEIVED ON LOCAL PORCH · all uses are held. No upload or public page change.");
  } catch (error) { say("HOLD · " + error.message); }
}
function withGift(action) {
  const gift = current();
  if (!gift) { say("Select a gift first."); return; }
  try {
    stopProposedAudio();
    action(gift);
    render();
  } catch (error) { say("HOLD · " + error.message); }
}
function porch(decision) {
  withGift(gift => {
    reviewPorch(gift, {
      id: newId("review"), decision, by: reviewActor(), at: now(),
      reason: "local review demonstration"
    });
    say("PORCH " + decision.toUpperCase() + " · no use was admitted.");
  });
}
function scopedUse(decision) {
  withGift(gift => {
    const use = $("gift-use").value;
    reviewUse(gift, {
      id: newId("review"), use, decision, by: reviewActor(), at: now(),
      releaseCheck: $("gift-release-check").value
    });
    say(use.toUpperCase() + " · " + decision.toUpperCase() +
      " in this local demonstration only. No publication/air/playback action.");
  });
}
function withdraw() {
  const gift = current();
  if (!gift) return;
  if (!window.confirm("Withdraw this contribution from all NEW local uses? This cannot recall previously exported copies.")) return;
  withGift(g => {
    withdrawGift(g, { id: newId("review"), by: reviewActor(), at: now(), reason: "local withdrawal request" });
    say("WITHDRAWN · local projections held. Previously exported copies require separate human cleanup.");
  });
}
async function reattach() {
  const gift = current();
  if (!gift) return;
  try {
    const file = $("gift-reattach-file").files?.[0];
    const data = await hashMedia(file, gift.kind);
    attachAsset(gift, data);
    render();
    say("Exact media bytes reattached to this device only. Previous review permissions remain held until repeated.");
  } catch (error) { say("HOLD · " + error.message); }
}
function exportPocket() {
  if (!pocket?.gifts.length) { say("Nothing to export."); return; }
  if (!window.confirm("Export private contribution text, credit labels, media hashes, and review history to a JSON file on this device? No raw media bytes are included.")) return;
  if (exportLink) URL.revokeObjectURL(exportLink);
  exportLink = URL.createObjectURL(new Blob([JSON.stringify(pocket, null, 2) + "\n"], { type: "application/json" }));
  const a = $("gift-export-link");
  a.href = exportLink;
  a.download = relicId + "-local-gifts.json";
  a.hidden = false;
  a.click();
  say("Private snapshot offered for local download. On another device all approvals must be re-reviewed.");
}
async function importPocket() {
  const file = $("gift-import").files?.[0];
  if (!file) { say("Select a JSON export first."); return; }
  if (file.size > 400000) { say("HOLD · import exceeds local limit."); return; }
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = recheckImportedPocket(parsed, relicId);
    if (!window.confirm("REPLACE this browser's unsaved local gifts with imported material? All incoming permissions will be HELD for fresh review.")) return;
    stopProposedAudio();
    pocket = incoming;
    selectedId = "";
    render();
    say("IMPORTED INTO LOCAL HOLD · " + incoming.gifts.length +
      " contributions. Historical approval carried no new authority. Media must be reattached.");
  } catch (error) { say("IMPORT REFUSED · " + error.message); }
}
async function playInfluence() {
  const gift = current();
  if (!gift || !eligibleForLocalUse(gift, "music") || !$("fixture-confirmed").checked) {
    say("HOLD · both consented local music use and synthetic confirmation are required.");
    return;
  }
  try {
    const response = await fetch("./relics/" + relicId + ".json", { cache: "no-store" });
    if (!response.ok) throw new Error("No verified sample manifest.");
    const doc = validateRelic(await response.json());
    if (doc.relic_id !== relicId) throw new Error("Relic mismatch.");
    const base = deriveConsequences(doc, doc.demonstration_confirmation_id, {
      enableFixtureConfirmation: $("fixture-confirmed").checked
    });
    const influence = makeMusicInfluence(gift, base);
    if (!influence) throw new Error("Permission no longer admitted.");
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error("Web Audio unsupported.");
    stopProposedAudio();
    const ctx = new Context();
    proposedAudioContext = ctx;
    await ctx.resume();
    let t = ctx.currentTime + 0.05;
    for (let i = 0; i < influence.notes.length; i++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      const duration = influence.durations_seconds[i];
      osc.type = "sine";
      osc.frequency.value = 440 * Math.pow(2, (influence.notes[i] - 69) / 12);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.93);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
      t += duration;
    }
    status("gift-music-status", "HELD ORIGINAL MOTIF VARIATION · " + influence.notes.join(" / ") +
      ". No source audio incorporated. No radio publication.");
  } catch (error) {
    stopProposedAudio();
    say("HOLD · " + error.message);
  }
}
if (!pocket) {
  say("HOLD · invalid relic ID. No contributions possible.");
  $("gift-create").disabled = true;
} else {
  $("gift-create").addEventListener("click", createContribution);
  $("gift-list").addEventListener("change", () => { selectedId = $("gift-list").value; stopProposedAudio(); render(); });
  $("gift-use").addEventListener("change", render);
  $("fixture-confirmed").addEventListener("change", () => { stopProposedAudio(); render(); });
  $("gift-porch-welcome").addEventListener("click", () => porch("welcome"));
  $("gift-porch-hold").addEventListener("click", () => porch("hold"));
  $("gift-porch-refuse").addEventListener("click", () => porch("refuse"));
  $("gift-use-admit").addEventListener("click", () => scopedUse("admit"));
  $("gift-use-hold").addEventListener("click", () => scopedUse("hold"));
  $("gift-use-refuse").addEventListener("click", () => scopedUse("refuse"));
  $("gift-withdraw").addEventListener("click", withdraw);
  $("gift-reattach").addEventListener("click", reattach);
  $("gift-export").addEventListener("click", exportPocket);
  $("gift-import-apply").addEventListener("click", importPocket);
  $("gift-influence").addEventListener("click", playInfluence);
  window.addEventListener("pagehide", () => {
    stopProposedAudio();
    if (exportLink) URL.revokeObjectURL(exportLink);
  });
  render();
}
