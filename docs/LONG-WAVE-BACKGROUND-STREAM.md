# HUMKIN — LONG WAVE (experimental continuous-background receiver)

## Why this exists

The current web radio rotates between independent MP3 URLs in JavaScript. On Android,
turning off the screen can suspend those callbacks, even when R2 itself is playing
perfectly. More preloading into Supabase would duplicate storage and still leave a
JavaScript switch between songs. Long Wave keeps one native `<audio>` connection open,
so the browser's media engine can continue through song boundaries with no script wake-up.

## What has been built and verified

- `worker.mjs`: Cloudflare Worker `GET /live.mp3` that creates a single continuous
  `audio/mpeg` response by streaming **only published, enabled, R2-backed** crate
  objects directly from an R2 bucket binding. It also includes reviewed/approved
  manifest-only R2 recordings, e.g. Blue At The Tip. No credentials leave Cloudflare.
- Maintains songs and length-grouped bumpers, additional released single spins,
  seasonal 3× total, roughly 11/22-minute medium/long break targets and short drops.
  Existing editorial holds and obvious dated time/request claims are excluded.
- Strips initial ID3v2 metadata tags between adjacent MP3 files so decoders see
  the MP3 frame stream without internal ID3 headings. Does not transcode audio.
- No client track-boundary callbacks. A single stream can traverse hundreds of
  MP3s. `/health` reports when the public catalog and R2 binding are ready.
- `site/index.html` + `site/receiver.js` + `site/long-wave.css`: separate
  phone-facing player with a saved, allowlisted streaming URL (no need to alter
  the working Same-Time or Road Shuffle browser controls until validated).
- Tests: `node --test worker.test.mjs receiver.test.mjs` (Node 22+).

## Cloudflare setup (one time)

1. Open Cloudflare Dashboard → **Workers & Pages → Create** → **Worker**. Name it
   `humkin-long-wave`, enable its public `*.workers.dev` route, and deploy.
2. Open the Worker's **Edit code** screen and paste the full `worker.mjs` source;
   click **Deploy**.
3. Under the Worker's **Settings → Bindings**, add an **R2 bucket binding**:
   - Variable name: **`RADIO_MEDIA`**
   - Bucket: **`humkin-radio-media`**
   Save and redeploy if prompted. This binding requires no R2 API keys, secrets,
   tokens, or account IDs to paste into the application.
4. Check `https://<your-worker>.<your-subdomain>.workers.dev/health`.
   It should return JSON containing `"ok":true` and a positive `r2_catalog`.
5. Open `https://<your-worker>.<your-subdomain>.workers.dev/live.mp3` in a browser,
   tap Play and verify **several songs and bumpers** follow naturally while the
   phone screen is locked. This is the essential real-device acceptance test.
6. Optionally open the separate Long Wave receiver HTML page and enter the full
   Worker `/live.mp3` URL; the page stores it on that device.
7. After the device test passes, put that verified HTTPS URL in the web station's
   published configuration or add a distinct Long Wave nav entry. The default
   `rotation.json.live_stream_url` overrides Same-Time Radio; **do not flip it**
   until you're ready to replace simulated Same-Time with personal live streaming.

### CLI alternative

With Node and an authenticated Wrangler installation, this folder includes
`wrangler.toml`. Run `npx wrangler@latest deploy` from the folder. Wrangler will
use the R2 binding declared in the TOML. Never commit Cloudflare API tokens.

## Important honest limitations

- **Not deployed by the code alone.** The Worker must be created in the owner's
  existing Cloudflare account (no Cloudflare account connection is available to
  this assistant). The public website's radio continues using its old modes
  until an actual endpoint exists and is deliberately activated.
- Even a single audio stream can be interrupted by Android's networking, battery
  optimization, user data limits, or a dropped connection. The design removes
  *per-track JavaScript restarts*; it cannot guarantee all-day operation under
  every OS power management policy.
- Unlike genuine centrally clocked Icecast, each Worker connection builds its
  own rotation. This is **personal continuous radio**, not synchronized Same-Time.
  Live song titles and per-track listening/Top-42 receipts aren't yet emitted to
  the client (those remain in the regular station modes).
- Free Workers have an internal-service-subrequest limit. The stream deliberately
  stops after 900 R2 objects to avoid hitting the request cap. With ordinary
  several-minute recordings this is many hours, but not literally infinite.
- Raw MP3 files can differ in sample rate, encoder tags, and bitrate. The Worker
  strips leading ID3v2 tags but **does not normalize every file**. Local synthetic
  concatenation decoding was checked; final acceptance requires playing actual
  source transitions on Android. For guaranteed broadcast-quality transitions,
  the existing FFmpeg/Icecast engine should eventually transcode to a constant
  broadcast format and originate one continuous stream.
- No media is copied to Supabase or changed in R2. The worker has read-only
  behavior, and the existing 152 recordings remain intact.


## New: shared Station One HLS is an independent, optional route

This Worker now also serves /hls/status, /hls/live.m3u8 and immutable
/hls/<session>/segment-<number>.ts from the SAME RADIO_MEDIA R2 binding.
These routes are independent of /live.mp3: Long Wave still supplies personal
unsynchronized rotation without the Acer. HLS requires the Acer-side
tools/radio-broadcast/hls_push.py to upload a real program.

For this multi-module Worker, deploy the complete folder via Wrangler; do
not paste only worker.mjs into the Cloudflare online editor, because it now
imports hls-routes.mjs. Full details: docs/R2-LIVE-HLS.md. Neither HLS nor
Long Wave changes the default fm/rotation.json until explicitly selected.
