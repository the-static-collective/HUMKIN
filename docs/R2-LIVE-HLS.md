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

