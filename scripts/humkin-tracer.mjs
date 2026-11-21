#!/usr/bin/env node
/* One recording through the HUMKIN evidence spine.
 * Read-only: no upload, broadcast controls, Supabase writes or SIA mutations.
 */
import {readFile, writeFile, stat} from "node:fs/promises";
import {makeTracerReceipt} from "./humkin-tracer-core.mjs";

const CATALOG = "https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-compost";
const BROADCAST = "https://humkin-long-wave.joyvolcanomusic.workers.dev";
const MAX = 1_000_000;
const USAGE = `Usage:
  node scripts/humkin-tracer.mjs --track <PUBLIC_CATALOG_ID> --live [--frequency station-one] [--out receipt.json]
  node scripts/humkin-tracer.mjs --track <PUBLIC_CATALOG_ID> --catalog compost.json [--hls live.m3u8] [--proposal signal-proposals.json] [--out receipt.json]

Read-only evidence inspection. The live option fetches only the existing public HUMKIN
catalog and HLS manifest. No broadcast, rating, publishing or owner approval occurs.`;

function argsOf(argv) {
  const result = {};
  const flags = new Set(["live", "help"]);
  const allowed = new Set(["track", "catalog", "hls", "proposal", "frequency", "out", ...flags]);
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--") || !allowed.has(token.slice(2))) throw Error("Unknown option: " + token);
    const name = token.slice(2);
    if (name in result) throw Error("Repeated option: " + token);
    if (flags.has(name)) result[name] = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw Error("Missing value for " + token);
      result[name] = value;
    }
  }
  return result;
}
async function local(path) {
  if ((await stat(path)).size > MAX) throw Error("Evidence input is too large.");
  return readFile(path, "utf8");
}
async function remote(url) {
  const response = await fetch(url, {cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(12000), headers: {"Accept": "application/json, application/vnd.apple.mpegurl, */*"}});
  if (!response.ok) throw Error("Public source HTTP " + response.status);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX) throw Error("Public evidence is too large.");
  const body = await response.text();
  if (body.length > MAX) throw Error("Public evidence is too large.");
  return body;
}
async function main() {
  const a = argsOf(process.argv.slice(2));
  if (a.help) { console.log(USAGE); return; }
  if (!a.track) throw Error("--track is required.\n" + USAGE);
  if (a.live && (a.catalog || a.hls)) throw Error("Use --live or local catalog/HLS evidence, not both.");
  if (!a.live && !a.catalog) throw Error("Supply --catalog or --live.");
  const frequency = a.frequency || "station-one";
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(frequency)) throw Error("Invalid frequency.");
  let catalog, playlist = null;
  if (a.live) {
    catalog = JSON.parse(await remote(CATALOG));
    const route = frequency === "station-one" ? "/hls/live.m3u8" : "/hls/" + frequency + "/live.m3u8";
    try { playlist = await remote(BROADCAST + route); }
    catch (error) {
      console.error("Live HLS cue unavailable (" + error.message + "). The receipt will not assert transmission.");
    }
  } else {
    catalog = JSON.parse(await local(a.catalog));
    if (a.hls) playlist = await local(a.hls);
  }
  const proposals = a.proposal ? JSON.parse(await local(a.proposal)) : null;
  const receipt = makeTracerReceipt({
    trackId: a.track, catalog, playlist, proposals, frequency,
    source: a.live ? "live_public_fetch" : "operator_files"
  });
  const output = JSON.stringify(receipt, null, 2) + "\n";
  if (a.out) {
    await writeFile(a.out, output, {encoding: "utf8", flag: "wx"});
    console.log("Read-only tracer receipt written. No station, payment, or publishing state changed.");
  } else {
    process.stdout.write(output);
  }
}
main().catch(error => { console.error("HUMKIN TRACER: " + error.message); process.exitCode = 1; });
