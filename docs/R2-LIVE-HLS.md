# HUMKIN — Station One R2 live HLS (experimental)

## Current status

Code exists for the Acer's Station One FFmpeg output, local R2 publisher, shared
Cloudflare Worker HLS route and isolated browser receiver. **Nothing is
automatically live or deployed.** No credentials, R2 permission, website playback
setting, Android APK or payment plan has been changed by this patch.

This is NOT Long Wave personal rotation. This is **one synchronized station**:
Acer audio programmer → 10-second AAC-in-MPEG-TS HLS segments → R2 objects →
Cloudflare Worker /hls/live.m3u8 → HLS-capable listeners.

The existing Station One Icecast output, Long Wave /live.mp3, Same-Time Radio,
Supabase catalog, and app remain unchanged unless an operator deliberately cuts
over. In particular, fm/rotation.json live_stream_url is still null.

## One-time deployment and permissions

The isolated live relay must not modify music stored in humkin-radio-media.
R2 S3 upload credentials are bucket-scoped to humkin-radio-live; the Worker
uses RADIO_LIVE for live playback and RADIO_MEDIA for existing Long Wave.
Neither credential nor an R2 account write token is distributed to listeners.

1. Deploy the existing Long Wave Cloudflare Worker **from its whole source folder**
   (now a multi-module Worker): tools/radio-broadcast/cloudflare/. Use
   an authenticated Wrangler CLI, e.g. from that directory:
   npx wrangler@latest deploy
   The wrangler.toml binds RADIO_MEDIA to two separate buckets: RADIO_MEDIA to the existing
   humkin-radio-media archive and RADIO_LIVE to a new humkin-radio-live bucket.
   **Before deployment**, create the new private humkin-radio-live R2 bucket in
   the same Cloudflare account. The Worker serves only the live playlist and
   segments from RADIO_LIVE; the old Long Wave continues reading RADIO_MEDIA. An existing Cloudflare deployment may need an
   explicit approval/update; don't paste worker.mjs alone into Dashboard editor
   because it imports hls-routes.mjs.
2. **Create a new R2 S3 API token scoped ONLY to the new humkin-radio-live
   bucket**, with object read/write/delete as needed. Never give the Acer
   the permanent music archive's S3 write credential. The token is
   entered only on the Acer, never in a browser, issue, or GitHub secret.
   Cloudflare account ID is also required. Do not use the public Supabase key
   as an R2 secret; the services have independent credentials.
3. On the Acer, make sure FFmpeg/ffprobe and Python 3.9+ are on PATH.
   Install the optional upload library locally:
   py -3 -m pip install --user boto3
4. Set these in the local terminal environment (never commit them):
   CLOUDFLARE_ACCOUNT_ID, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
   For the secret, use a masked PowerShell prompt rather than a typed command
   that ends up in terminal history.
5. **Preferred on the Acer:** launch windows/STATION-ONE.cmd, select
   **6 — R2 live HLS test**, and follow the masked prompts for a supervised
   70-second run. It requests explicit R2 TEST confirmation. Alternatively,
   from the repository root (after configuring environment variables), run:
   py -3 tools\radio-broadcast\hls_push.py --seconds 70
   The uploader starts engine.py with a private temporary HLS directory,
   encodes AAC at 96 kbps by default and uploads complete segments first.
   A 70-second test is recommended; it leaves a short playlist on R2,
   which correctly becomes **offline** after 90 seconds without updates.
   Remove --seconds for a continuous supervised test.

### Masked PowerShell credential example

From a *local* PowerShell terminal on the Acer:

    $env:CLOUDFLARE_ACCOUNT_ID = Read-Host "Cloudflare Account ID"
    $env:AWS_ACCESS_KEY_ID = Read-Host "R2 S3 Access Key ID"
    $secret = Read-Host "R2 S3 Secret Access Key" -AsSecureString
    $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try { $env:AWS_SECRET_ACCESS_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }
    py -3 -m pip install --user boto3
    py -3 tools\radio-broadcast\hls_push.py --seconds 70
    Remove-Item Env:AWS_SECRET_ACCESS_KEY,Env:AWS_ACCESS_KEY_ID -ErrorAction SilentlyContinue

You can stop a continuous broadcast with Ctrl+C. A clean stop does NOT
automatically switch the site or point users to stale HLS.

## Verify with a second device

Given the actually deployed Worker URL (do not guess a hostname):
- GET /hls/status — {"on_air":true,...} only when the uploaded playlist is
  no older than 90 seconds, otherwise HTTP 503.
- GET /hls/live.m3u8 — a current HLS playlist with absolute session identity
  encoded into segment paths, no credentials.
- The test page is fm/long-wave/hls.html on HUMKIN's GitHub Pages site.
  Enter your deployed Worker https URL ending with /hls/live.m3u8.
  Its optional **Rescue to Long Wave** setting (checked by default) attempts
  a switch to the same Worker's /live.mp3 when live HLS fails. Long Wave is
  a different unsynchronized, per-listener station; rescue is not a seamless
  continuation of the shared program. No audio automatically starts before
  the listener presses Play. **Retry live signal** is manual, to avoid
  unwanted automatic jumps between programs.
  This receiver uses native HLS where supported and hls.js on other browsers.
- Test 3+ segment changes, listening from mobile cellular, a short disconnect,
  and reboot/reconnect. Force a disconnected Acer and verify receiver rescue
  into Long Wave; then try manual return to HLS. A browser may suspend the
  20-second status watchdog while the screen is locked, so test that case
  explicitly. Only then discuss a default website/app source switch.

## Cost and cleanup guardrails

At 10 seconds per segment, continuous publishing creates about 259,200 media
objects and 259,200 playlist overwrites per 30 days: roughly 518,400 R2 writes,
plus up to 259,200 deletion operations (approximately 777,600 Class A
operations total) before retries and other HUMKIN operations. These share the
account's Cloudflare allowance, even though the live relay uses a separate
bucket. Actual
Cloudflare plan allowances and billing must be checked before going 24/7.

The publisher retires segments 180 seconds after they leave the current playlist,
so the live bucket does not accumulate forever during a healthy run. **Also add an
R2 lifecycle rule** to expire objects under live/station-one/ after one day
(or another deliberate short retention), to cover crashes and old session IDs.
If retaining radio history is desired, archive it to a distinct intentional
prefix instead of disabling the live cleanup. The live.m3u8 is overwritten,
not append-only.

R2 read and Worker request volumes scale with listener count and can incur
charges or hit Free plan limits. R2 egress is advertised as free, but this
does not make Workers or HLS.js CDN use unlimited or guaranteed free.
The Acer needs steady electricity and internet. Don't rely on this prototype
as unattended 24/7 broadcasting without watchdog and reconnect tests.

## Implementation safety contracts

- No inbound listener or source port on Windows. Only HTTPS S3 uploads to R2.
- All public HLS paths are strict: /hls/live.m3u8 or
  /hls/<32-hex-session>/segment-<sequence>.ts.
- Publisher rejects arbitrary filenames, missing segments, unsupported
  encrypted/byterange playlist modes, and incomplete MPEG-TS files.
- Only fully uploaded segments may appear in the public live playlist.
- HLS playlist freshness uses the R2 object upload timestamp, not stale local
  metadata or a guessed program state.
- Rolling R2 segment keys are immutable per session to prevent restart/caching
  collisions. Old sessions are collected via the R2 lifecycle rule.
- Audio content is still subject to normal broadcast rights/provenance review.
- No track-level now-playing metadata, phone background-play guarantee, dynamic
  user submissions, requests or native APK cutover is provided yet.
- /hls/status is an **ingest freshness indicator**, not proof that a person
  heard the station. Player fallback does not assert successful listening.

## Offline verification

    python tests/hls-relay.test.py
    node --test tools/radio-broadcast/cloudflare/hls-routes.test.mjs
    node --test tools/radio-broadcast/cloudflare/worker.test.mjs
    python tests/hls-encoder-smoke.py

The last check needs local FFmpeg and generates only synthetic silent audio.
