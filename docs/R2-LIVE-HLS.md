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
4. **Preferred on the Acer:** launch `tools\radio-broadcast\windows\STATION-ONE.cmd`,
   choose **6 — R2 live HLS test**, and enter `R2 TEST`. The first run prompts
   for Cloudflare Account ID and R2 S3 Access Key ID. For the secret, choose
   **C** to import a copied key directly from the Windows clipboard instead of
   trying to paste into an invisible SecureString prompt. The clipboard is
   cleared afterward. Choose **H** for hidden manual entry if preferred.
   The launcher saves the three fields encrypted using the Windows current-user
   DPAPI in `%LOCALAPPDATA%\HUMKIN\StationOne\r2-live-credentials.dpapi`.
   **Subsequent tests reuse these encrypted credentials without prompting.**
   The saved file can only be decrypted by the same Windows account on the
   same PC; don't copy it to GitHub, the website or a different machine.
   If a secret was not saved from an earlier test, Cloudflare cannot reveal it
   again: generate a new bucket-scoped R2 token if needed. **Menu option 7**
   resets the local vault when rotating keys; it does not revoke the token
   in Cloudflare.
5. The test runs for **70 seconds** using a temporary HLS directory and
   96 kbps AAC by default. FFmpeg normally writes a one- or two-segment
   playlist at startup. The publisher now waits for **three complete
   segments** before sending any manifest, while rejecting malformed paths
   and encrypted/unsafe playlists. A short test finishes naturally; the
   Worker reports offline after 90 seconds without an updated playlist.

For advanced manual runs from the repository root, environment variables
`CLOUDFLARE_ACCOUNT_ID`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`
still work with:

    py -3 tools\radio-broadcast\hls_push.py --seconds 70

Do not type the secret into a persistent shell command or commit it to code.
The launcher is preferred because it prompts once, protects the saved secret,
and clears the child's environment after the test. Remove `--seconds` for a
continuous **supervised** run only after verifying the public live receiver.

You can stop a continuous broadcast with Ctrl+C. A clean stop does NOT
automatically switch the site or point users to stale HLS.

## Continuous managed Station One on the Acer

After the 70-second R2 test works, download a fresh ZIP of this PR branch.
Extract the full ZIP; the current-user encrypted R2 credential vault survives
under `%LOCALAPPDATA%\HUMKIN\StationOne\r2-live-credentials.dpapi` even
when you use a different checkout folder.

From `tools\radio-broadcast\windows`, double-click:

- `START-HUMKIN-LIVE.cmd` — asks for `ON AIR` confirmation and then
  launches the Python/FFmpeg R2 publisher in a separate **background process**
  without adding any credentials to command-line arguments. It uses the
  already-saved Windows DPAPI vault. The broadcaster keeps running when the
  launcher window closes, but **will stop if Windows sleeps, shuts down,
  reboots, loses power, or its connection fails**. No automatic reconnect
  or startup-after-reboot service is promised yet.
- `STATUS-HUMKIN-LIVE.cmd` — reports the managed process state and recent
  local output; logs are stored at
  `%LOCALAPPDATA%\HUMKIN\StationOne\live-output.log` and
  `live-errors.log`. Do not mistake this process status for proof of
  public audio reception.
- `STOP-HUMKIN-LIVE.cmd` — writes a run-specific stop marker. The engine
  observes the request while writing audio and closes FFmpeg so the last
  segment can finish; the publisher waits for completed files. The remote
  HLS manifest expires as offline at the Worker **within 90 seconds
  after the last playlist upload**. Use STATUS again to confirm that the
  background process actually ended.

These commands are also menu choices **8 START**, **9 STOP**, **0 STATUS**
in `STATION-ONE.cmd`. Option 6 remains the 70-second supervised test;
option 7 resets the locally saved R2 credentials (not the Cloudflare token).

Only one managed transmitter starts from this launcher at a time. Starting
an old test ZIP, a separate terminal instance, or another machine could still
cause competing publications; do not run a second publisher concurrently.
This experimental managed launch is not yet an unattended, auto-restarting
24/7 service. Plan operation hours and verify billing/usage before long runs.

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
