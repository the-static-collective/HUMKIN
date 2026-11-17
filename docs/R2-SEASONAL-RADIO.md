# R2 Public Radio + Seasonal Rotation — November 17, 2026

## Source of truth / non-assumptions

- The public radio currently runs at `https://humkin.abundent.org/fm/`.
- DNS for `media.abundent.org` exists in the connected Cloudflare zone; that does **not** prove a particular R2 object can be retrieved or that the bucket is attached correctly.
- On November 17 the creator provided the R2 object key `tracks/Blue At The Tip.mp3` and confirmed successful public playback. An independent GitHub Actions job downloaded the actual public MP3, verified it as audio, determined **193.960000 seconds** with ffprobe, confirmed **6,095,160 bytes** and an HTTP byte-range response of **206**.
- `fm/r2-tracks.json` publishes the now-verified recording with `approved: true`, `duration_seconds: 193.96` and `seasonal: true` (3× total airtime per cycle). The title derives from the exact object filename. The artist and editorial seasonal label are user-project defaults.
- **Verified by the owner's Cloudflare DNS screenshot:** `media.abundent.org` appears as DNS record **Type: R2**, **Target: `humkin-radio-media`**, **Proxy: Proxied**. Cloudflare internally represents its target as `public.r2.dev` in the DNS editor, but this record is specifically R2-managed, not an unsupported user-created CNAME to a development hostname. **Do not delete or change this record.** The public MP3 has been successfully downloaded, decoded and measured by GitHub Actions. Cloudflare's bucket Custom Domains dashboard can still be checked directly for its status.
- Never surface contents of `humkin-radio-private` or an unpublished production/stem bucket. This manifest is strictly for owner-approved public media.
- Website and Android releases are separate: a browser-radio change does not silently update or re-sign the native APK.

## One-track owner-approved load-in

1. In Cloudflare R2, select the public bucket `humkin-radio-media`. The DNS screen confirms a **Type R2** record points to this bucket; confirm **Custom Domains** includes `media.abundent.org` with status **Active** and HTTPS. **Do not delete its R2 DNS record.**
2. Copy the uploaded MP3's **object key**, not a private S3 URL or token. Example: `tracks/Fall Anthem.mp3`. Do not assume the example exists.
3. Confirm the file is public, approved for broadcast, and has correct `Content-Type: audio/mpeg`.
4. Obtain its accurate duration in seconds (decimals supported), title and artist. For `Blue At The Tip`, this was measured through ffprobe on the actual public R2 MP3 as `193.960000`. No invented duration was used.
5. Add an entry to `fm/r2-tracks.json` and explicitly mark it `approved: true`:

```json
{
  "schema": "humkin.radio.r2/v1",
  "tracks": [
    {
      "id": "fall-anthem",
      "object_key": "tracks/Fall Anthem.mp3",
      "title": "Fall Anthem",
      "artist": "HUMKIN",
      "album": "HUMKIN RADIO · SEASONAL",
      "duration_seconds": 180,
      "approved": true,
      "seasonal": true
    }
  ]
}
```

**This Fall Anthem example is fictional, not a published track; the verified Blue At The Tip entry is now approved in the canonical R2 manifest.** An unapproved or invalid entry is ignored. An empty manifest is a deliberate safe default. Object keys are URL-encoded per path segment and served from the allowlisted `https://media.abundent.org` origin; the static site never contains Cloudflare secret keys.

6. Confirm the resulting HTTPS object URL is directly playable, supports byte range requests for seeking, and has suitable CORS for frontend preloading. For the browser at `https://humkin.abundent.org`, grant only needed public GET/HEAD methods and origin; localhost needs a separate origin during local development. The native audio element can still fall back to direct playback if a JavaScript prefetch is refused.
7. Run `node tests/r2-seasonal.test.mjs`, then the existing radio tests, merge and verify the actual live web player. Preserve published GitHub Pages audio as backup until confirmed.

## Exact seasonal policy

- Default radio-only song: **1** slot per completed music rotation.
- Explicit curated release/official single: **2** slots (existing rule).
- A song marked `seasonal: true` in the approved R2 manifest (or separately named in `fm/rotation.json` seasonal track IDs): **3 slots total**. This supersedes rather than multiplies the release bonus.
- Both `SAME-TIME RADIO` and `ROAD SHUFFLE` use the same source weighting. Same-Time keeps stable music-duration totals across seeded cycles and avoids cycle-edge repeats. Shuffle keeps existing one-hour listening memory, so actual time-between-plays can differ.
- Remove `seasonal: true` when the feature ends. There is no automatic date expiry or calendar inference. Seasonal songs are not more eligible for voting or artificial chart plays: the Top 42 accounting remains separate.
- Bumper insertion, programmed shows, Top 42 7% share and original website remain unaffected.

## Verify the actual cloud file on Windows

In a terminal, substitute the approved **actual** public URL:

```powershell
curl.exe -I "https://media.abundent.org/REAL_OBJECT_KEY.mp3"
curl.exe --range 0-1023 --output NUL --dump-header - "https://media.abundent.org/REAL_OBJECT_KEY.mp3"
curl.exe -I -H "Origin: https://humkin.abundent.org" "https://media.abundent.org/REAL_OBJECT_KEY.mp3"
```

Expect `200` for an ordinary GET/HEAD, `206 Partial Content` for ranged GET where supported, and the required `Access-Control-Allow-Origin` header on cross-origin requests. Check the object URL in Chrome as well as in the Android radio; a working DNS record is not enough.

R2 is public file delivery, **not** an always-on live Icecast/AzuraCast stream or a substitute for broadcast rights checks. The computer can produce shows and future server schedules while the existing site distributes approved recordings independently.

## Blue At The Tip verified activation

- Actual R2 object key: `tracks/Blue At The Tip.mp3`
- Expected URL **after supported custom-domain connection**: `https://media.abundent.org/tracks/Blue%20At%20The%20Tip.mp3`
- Requested editorial rotation: **3× total** per music cycle, `seasonal: true`.
- Cloudflare DNS record is confirmed as **Type R2** and bound to the bucket; **do not remove it**. Public MP3 fetch passed, actual mp3 duration measured **193.960000 seconds**, range requests returned **206**. JavaScript cross-origin prefetch may require an R2 CORS policy; direct HTML audio playback remains the fallback.
- Verification is complete; `duration_seconds` and `approved` are set. SHA-256: `2958309e915c076bed880349fbb61c0c8d8b9dcd97f4e619a5f6c5661a23cd16`. GitHub Pages deployment and phone testing still establish actual end-user radio behavior; the R2 dashboard URL itself is private.
