# Cloud Autopilot Worker lab

Opt-in only; no changes to existing listeners. The `autopilot/` namespace
reads the **existing `RADIO_LIVE` binding** so the Acer's encrypted live-R2
credential can write the separate `autopilot/` prefix. Public archives use a
different bucket. No new Worker secret or permanent background process.

The client still needs an HLS-capable playback engine (native Safari or hls.js).
Start with an approved 2-track pilot, not the whole 10+ GB archive.

`node --test tools/radio-broadcast/cloudflare/cloud-autopilot.test.mjs`
and `python -m py_compile tools/radio-broadcast/autopilot_publisher.py`.

See [full operator manual](../../../docs/CLOUD-AUTOPILOT-LAB.md).
