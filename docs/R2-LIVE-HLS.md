# HUMKIN R2 live relay

The Acer encodes a continuous program as short AAC-in-MPEG-TS HLS segments. Its publisher uploads complete segments to R2 before it replaces the manifest. The public Cloudflare Worker serves the manifest and segments. The website follows Station One, with automatic Long Wave and Same-Time fallbacks. See [Acer Tower](ACER-TOWER.md) for local controls and launch commands.

## Deploy the Worker

Deploy from `tools/radio-broadcast/cloudflare` with the existing Cloudflare account and Worker name in `wrangler.toml`. The Worker imports a separate HLS module, so deploy the directory as a unit.

```sh
npx wrangler deploy
```

`RADIO_LIVE` binds the private `humkin-radio-live` bucket. `RADIO_MEDIA` binds the existing `humkin-radio-media` archive used by Long Wave. The Acer's S3 credentials should be scoped to `humkin-radio-live`. Existing installations reuse the operator's Windows DPAPI credential vault.

Each frequency has its own prefix under `live/`. Keep an R2 lifecycle for that live prefix to collect old segment sessions. The publisher also removes segments after they leave the playlist and its grace period. A later session can reupload cover files from the local Tower crate. Preserve media source files in the archive or crate.

## Verify the relay

| Path | Result |
| --- | --- |
| `/hls/live.m3u8` | Station One's completed HLS window |
| `/hls/status` | Station One's ingest freshness. An absent or stale manifest returns 503 |
| `/hls/now-playing` | Station One's latest cue in the published audio. The track may be null |
| `/hls/talk/live.m3u8` | An example secondary frequency |
| `/hls/talk/now-playing` | Latest cue for that frequency |

Open the [HUMKIN dial](https://humkin.abundent.org/fm/) from another device and play through a track change. Check the audio, title and cover together. For a controlled cutover, wait for the previous Station One publisher to exit before launching its replacement. Use distinct frequency IDs for simultaneous encoders.



## Reservoir laboratory (optional; existing public stream unchanged)

This stage produces **two HLS playlists from ONE AAC/TS encoder**. The publisher
uploads the same immutable segments once under the same session IDs and exposes:

| Path | Purpose |
| --- | --- |
| `/hls/live.m3u8` | Existing hot stream (public default, unchanged) |
| `/hls/delayed.m3u8` | Optional delayed laboratory stream, initially absent |
| `/hls/delayed-status` | Freshness of the delayed feed |
| `/hls/delayed-now-playing` | Track cue from the delayed timeline |

Secondary frequencies can use `/hls/<frequency>/delayed.m3u8`.
A strict parser rejects malformed media sequences, timestamps, remote URLs,
encryption, discontinuities and incomplete segments. Delayed segments are
published only after at least eight minutes of genuinely encoded audio exist
behind the hot edge; the two windows never require double encoding.
A browser opens `/fm/?reservoir=lab` to opt into the delayed stream
after the Worker and site revisions are deployed; normal `/fm/` stays hot.

**Experimental Acer rollout**: Update the complete checkout only during a
planned transmitter restart. Deploy the updated `cloudflare` Worker using
your normal deployment credentials. Stop the current managed broadcaster using
`STOP-HUMKIN-LIVE.cmd`; start
`START-HUMKIN-RESERVOIR-LAB.cmd` and type `ON AIR`. The lab enables 96
local ten-second HLS history segments and an eight-minute delayed index. The
normal launcher still starts without reservoir. Monitor `live-output.log` /
`live-errors.log` for the delayed update marker.
The delayed feed will not appear until enough audio has been encoded; this is
normal. Do not point the main website to delayed air until on-device
transition and timing tests have passed.

**Sleep prevention**: Every Windows `hls_push.py` broadcast uses
SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED) while that Python
process remains active, and clears the request on exit. This prevents
ordinary automatic idle system sleep without forcing the monitor on.
It does NOT override closing the laptop lid, explicit Sleep, Windows
shutdown, power loss or other system policy. Disable lid-close sleep in Windows
Power Options separately if necessary; keep ventilation unobstructed.

**Boundaries**: The reservoir is *server-side*. It is not yet an eight-minute
offline cache on phones; mobile devices still need downloaded bytes to survive
an outage. An automatic operator-driven "go hot" and re-establish-delay
switch requires a discontinuity-safe transition design, so this first stage
does not silently splice public audio or rewrite listener timestamps.
A listener can select the existing hot URL manually. Future offline receivers
should cache the already encoded segments ahead of the public clock,
with bounded storage and explicit consent.
