import { validateRelic, getRevision, deriveConsequences, fixedRelicUrl } from "./living-relic.core.mjs";
const $ = id => document.getElementById(id);
const query = new URL(location.href).searchParams;
const relicId = query.get("id") || "field-001";
let relic, outcome, recorder, recordingUrl, noteUrl;
const say = (id, message) => { $(id).textContent = message; };
function button(label, action, pressed) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "ghost";
  el.textContent = label;
  el.setAttribute("aria-pressed", String(pressed));
  el.addEventListener("click", action);
  return el;
}
function renderRevision(revisionId) {
  const selected = getRevision(relic, revisionId);
  $("revisions").replaceChildren();
  for (const r of relic.revisions) {
    $("revisions").append(button(r.id.toUpperCase(), () => {
      const u = new URL(location.href);
      if (r.id === relic.current_revision) u.searchParams.delete("rev");
      else u.searchParams.set("rev", r.id);
      history.replaceState(null, "", u);
      renderRevision(r.id);
    }, r.id === selected.id));
  }
  say("song-heading", selected.title);
  say("relic-story", selected.message);
  $("songs").replaceChildren();
  for (const song of selected.songs) {
    const wrapper = document.createElement("div");
    const label = document.createElement("p");
    label.textContent = song.title;
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.src = song.href;
    audio.setAttribute("aria-label", "Listen to " + song.title);
    wrapper.append(label, audio);
    $("songs").append(wrapper);
  }
}
function renderConsequence() {
  outcome = deriveConsequences(relic, relic.demonstration_confirmation_id, {
    enableFixtureConfirmation: $("fixture-confirmed").checked
  });
  $("play-motif").disabled = !outcome.accepted;
  if (!outcome.accepted) {
    say("gift-status", "HOLD · A report or withdrawn demo approval cannot activate consequences.");
    say("game-status", "HELD · no game proposal");
    say("music-status", "HELD · no music proposal");
    say("music-notes", "");
    return;
  }
  say("gift-status", "SYNTHETIC ONLY · Report and simulated confirmation found; no actual recipient attestation.");
  say("game-status", outcome.game.status + " · " + outcome.game.id);
  say("music-status", outcome.music.status + " · " + outcome.music.id);
  say("music-notes", "MIDI proposal: " + outcome.music.midi_notes.join(" · "));
}
async function playMotif() {
  if (!outcome?.accepted) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) { say("music-status", "Web Audio is not supported in this browser."); return; }
  $("play-motif").disabled = true;
  let context;
  try {
    context = new Context();
    await context.resume();
    let at = context.currentTime + 0.05;
    outcome.music.midi_notes.forEach((note, i) => {
      const length = outcome.music.durations_seconds[i];
      const osc = context.createOscillator();
      const vol = context.createGain();
      osc.type = "sine";
      osc.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
      vol.gain.setValueAtTime(0.0001, at);
      vol.gain.exponentialRampToValueAtTime(0.13, at + 0.024);
      vol.gain.exponentialRampToValueAtTime(0.0001, at + length * 0.93);
      osc.connect(vol).connect(context.destination);
      osc.start(at);
      osc.stop(at + length);
      at += length;
    });
    setTimeout(() => {
      context.close().catch(() => {});
      $("play-motif").disabled = !outcome?.accepted;
    }, Math.max(0, (at - context.currentTime) * 1000 + 80));
  } catch {
    if (context) context.close().catch(() => {});
    $("play-motif").disabled = !outcome?.accepted;
    say("music-status", "Audio could not be played on this device.");
  }
}
function exportNote() {
  const note = $("local-note").value.trim();
  if (!note) { say("record-status", "Write a note before exporting."); return; }
  if (noteUrl) URL.revokeObjectURL(noteUrl);
  noteUrl = URL.createObjectURL(new Blob([note + "\n"], { type: "text/plain" }));
  const a = $("download-note");
  a.href = noteUrl;
  a.download = "my-living-relic-note.txt";
  a.hidden = false;
  say("record-status", "Your note is available to download. No upload occurred.");
}
async function toggleRecording() {
  if (recorder?.state === "recording") {
    recorder.stop();
    say("record-status", "Finishing the private recording…");
    return;
  }
  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
    say("record-status", "Microphone recording is not supported here; text notes still work.");
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach(track => track.stop());
      $("record").textContent = "RECORD LOCALLY";
      if (!chunks.length) { say("record-status", "Nothing recorded."); return; }
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      const mimeType = recorder.mimeType || "audio/webm";
      recordingUrl = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
      const audio = $("local-play");
      audio.src = recordingUrl;
      audio.style.display = "block";
      const a = $("download-recording");
      a.href = recordingUrl;
      a.download = mimeType.includes("ogg") ? "living-relic-note.ogg" : "living-relic-note.webm";
      a.hidden = false;
      say("record-status", "Recorded on this device only. Download to keep it.");
    });
    recorder.addEventListener("error", () => {
      stream.getTracks().forEach(track => track.stop());
      $("record").textContent = "RECORD LOCALLY";
      say("record-status", "Recording failed; nothing was uploaded.");
    });
    recorder.start();
    $("record").textContent = "STOP RECORDING";
    say("record-status", "Recording locally. Press STOP when finished.");
  } catch {
    if (stream) stream.getTracks().forEach(track => track.stop());
    say("record-status", "Microphone permission denied or unavailable. No recording started.");
  }
}
async function copyFixedLink() {
  const url = fixedRelicUrl(relic.relic_id);
  try {
    await navigator.clipboard.writeText(url);
    say("link-status", "Fixed link copied.");
  } catch {
    say("link-status", url);
  }
}
async function load() {
  try {
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(relicId)) throw new Error("Invalid relic ID.");
    const res = await fetch("./relics/" + relicId + ".json", { cache: "no-store" });
    if (!res.ok) throw new Error("Relic not found.");
    relic = validateRelic(await res.json());
    if (relic.relic_id !== relicId) throw new Error("Relic ID mismatch.");
    const url = fixedRelicUrl(relicId);
    say("stable-url", url);
    $("share-link").href = url;
    renderRevision(query.get("rev") || relic.current_revision);
    renderConsequence();
  } catch (error) {
    say("relic-story", "Could not load: " + String(error.message || error));
    $("fixture-confirmed").disabled = true;
    $("copy-link").disabled = true;
    say("gift-status", "HOLD · no validated source manifest.");
  }
}
$("copy-link").addEventListener("click", copyFixedLink);
$("fixture-confirmed").addEventListener("change", () => { if (relic) renderConsequence(); });
$("play-motif").addEventListener("click", playMotif);
$("export-note").addEventListener("click", exportNote);
$("record").addEventListener("click", toggleRecording);
window.addEventListener("pagehide", () => {
  if (recorder?.state === "recording") recorder.stop();
  if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  if (noteUrl) URL.revokeObjectURL(noteUrl);
});
load();
