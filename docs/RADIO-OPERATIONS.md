# HUMKIN RADIO — operational field plan
**Status:** Browser radio rotation in development; separate true internet-radio server **not deployed**.  
**Station page:** `https://humkin.abundent.org/fm/` when merged/deployed.  
**Artist-facing full album:** `https://humkin.abundent.org/` preserved for the Walmart submission.  
**Creator's upcoming radio playlist:** not yet attached/ingested. The first rotation is transparently labeled a demo using existing MUTANT POP tracks.

## What "radio" means — three deliverables

| Level | Technology | What works | What it is not |
|---|---|---|---|
| 1 — Road shuffle | Static HTML5 audio and a published station rotation JSON | Press Tune In once; songs continue automatically while the browser is permitted to play; no-repeat shuffled rotation; Bluetooth/car audio and headset controls on devices/browsers that expose them | Not a synchronized broadcast or native car dashboard app |
| 2 — Same-time clock | Static HTML5 MP3s, seeded order for each full rotation, shared UTC epoch | Different visitors who choose Same-Time around the same moment **approximately** hear the same track/offset with no stream server | Not a guaranteed sample-accurate or continuously transmitting internet radio station; buffers and device suspend can shift playback |
| 3 — Actual web-radio stream | AzuraCast (AutoDJ / Liquidsoap) with Icecast endpoints or a hosted equivalent | One independent 24/7 live signal, schedules, station IDs, live DJ takeover, listener directories, radio-player URL; usable by compatible internet radios | Not terrestrial FM broadcasting, and no license is automatically supplied by the software |

The web page offers Levels 1–2. A `live_stream_url` slot is reserved in `fm/rotation.json` for Level 3. When configured with a **verified working HTTPS audio stream URL**, Same-Time mode can become actual stream tuning; add now-playing metadata later if an endpoint with appropriate CORS is available. Do not set this field until the stream truly exists.

## Exact action after the creator finishes selecting the car-radio playlist

1. Obtain a **tracklist in preferred order, or a group of approved source MP3s**. Either works. Do not attempt to pull Suno audio through undocumented endpoints or stream rip.
2. For each selected track, confirm an approved Suno paid-tier download, original file copy, song title, and track duration. The creator reports all works were generated on Premier and aren't other artists' remixes; preserve that as creator testimony, with file-level verification to be completed as needed.
3. Upload files to a rights-controlled audio host. For a modest first collection, `fm/audio/` can be a temporary GitHub Pages option; do not turn a large backcatalog into a huge git history. Plan to migrate sustained large downloads and radio traffic to object storage or a streaming service.
4. Replace `fm/rotation.json` with the `track_list` shape below and mark it `curated`. Validate every file's existence/duration; update the tests accordingly.
5. Radio sound processing: do a **human listen** for transitions, excessive level jumps, unpleasant silence, clipping, loudness, start/end trimming. Keep masters unaltered; derive separate broadcast copies. A sensible initial spoken station ID cadence is one short ID every 3–5 songs, but only when properly produced and approved by the creator. Avoid inserting unlicensed clips or copyrighted sound beds.
6. Test browser, Android over Bluetooth, and locked-screen audio behavior. Lock-screen media buttons depend on mobile OS/browser and aren't a replacement for a native Android Auto app. Browser audio can stop when the phone suspends it.
7. Only when ready, provision a real always-on server, add an HTTPS stream, publish a machine-readable playlist (M3U/PLS) for internet radio directories, and register with directories accepting independently operated stations.

### Example `track_list` rotation

```json
{
  "schema_version": 1,
  "station_name": "HUMKIN RADIO",
  "status": "curated",
  "status_note": "The new car-radio rotation, selected by the creator.",
  "source_type": "track_list",
  "synced_clock_epoch_utc": "2026-11-13T00:00:00Z",
  "live_stream_url": null,
  "tracks": [
    {
      "id": "01",
      "title": "Song One",
      "artist": "HUMKIN",
      "duration": 193.28,
      "src": "./audio/song-one.mp3",
      "artwork": "../cover.jpg"
    }
  ]
}
```

Never put an unverified remote track URL, unsupported format, or nonexistent file in the published playlist. More songs should be added before calling the rotation a broad musical radio service.

## Radio broadcast infrastructure: self-host vs cheap VPS

**Candidate:** AzuraCast official project (Docker). Official minimum is an x86-64 or ARM64 host, 2 GB RAM and ~20 GB disk; 4 GB+ is safer. It supports scheduled/shuffled AutoDJ, live-DJ takeover, public player and remote relay.  
Docs: https://www.azuracast.com/docs/  
Requirements: https://azuracast.com/docs/getting-started/requirements/  
AutoDJ media management: https://azuracast.com/docs/user-guide/media-management/  
Live DJ connection: https://azuracast.com/docs/user-guide/streaming-software/

**Operating route:**

- A physically owned computer can run the AutoDJ, but continuous reachability requires stable power, public endpoint/tunnel or port forwarding, DNS, HTTPS, monitoring, backup storage and enough outbound upload bandwidth.
- A small VPS can be the public receiver/relay while your home computer supplies the broadcast signal; for reliability, prefer running a fallback AutoDJ on the VPS so it keeps playing when the local computer goes offline.
- The radio site stays on GitHub Pages while the heavy continuous stream lives at a separate station host (`radio.abundent.org` is a possible *proposed* subdomain, not an active deployment).
- For rough bandwidth planning: 128 kbps * 3600 s / 8 ≈ **57.6 MB per listener-hour**. Ten simultaneous listeners all day would require about **13.8 GB/day**, or ~415 GB over a 30-day month. Avoid pretending a consumer residential uplink can necessarily serve high listener counts.
- Stream variants: at least one broadly compatible MP3/AAC mount; consider a lower bitrate for mobile. Resolve codecs/transcoding in the actual AzuraCast server.
- Test recovery if AutoDJ, home internet, or power fails. A station directory requires a real always-available stream URL, not merely the browser player.

## Licensing — do not conflate permissions

The creator reports these recordings were made on Suno Premier, not remixes of other artists' songs, and intended from the start as reusable assets. Suno's September 3, 2026 Terms allow paid-tier creators to commercially use eligible **approved downloaded** works and distinguish contractual permission from copyright protection. They do not automatically grant clearance to external songwriters or licenses to unrelated music. Song-by-song records still matter.

For a noninteractive US web radio service, **sound recording** digital-public-performance rights and **musical-composition** performance rights are distinct. SoundExchange explains the statutory framework, when it applies and what it doesn't cover. Direct licenses from the actual relevant rights holders can be an alternative where valid and complete, but an artist-operated stream should not assume "everything is free" without checking underlying composition, contributor and PRO/publisher status. A station adding other artists' tracks can make this considerably more involved.

- SoundExchange official licensing guide: https://www.soundexchange.com/service-provider/licensing-101/
- Suno official terms: https://suno.com/terms/
- For terrestrial FM, US FCC licensing is a **separate project**. Low Power FM is ordinarily restricted to eligible local nonprofit/government/tribal applicants, not individuals. Unlicensed Part 15 FM is only extremely low-power under the field-strength limits; do not invent a local public frequency or suggest unlicensed long-distance transmitters.
- Do not confuse Spotify/DistroKid distribution, online streaming radio, an FM transmitter, Bluetooth phone listening, or business background music; they are different pathways and licenses.

## Actual discoverability once the stream is real

After obtaining an always-on public HTTPS MP3/AAC endpoint, a public station identity, legal clearance, and reliable uptime, we can apply to:

- Radio Garden station submission: https://radio.garden/settings/submit
- RadioBrowser (community-maintained internet radio directory; verify instructions before posting).
- TuneIn station directory (verify broadcaster requirements; artist song submissions are **not** accepted as station submissions).
- Interested independent community, college, and internet radio programmers (for their own broadcast airplay), separately from launching our own station.

**Do not submit the browser-only player as a live internet radio URL**, and don't claim directory listings until accepted.

## Car access

A phone's ordinary browser can send audio to car stereo by Bluetooth or USB, depending on device/car support. The web player uses HTML audio and the Media Session API where available. Chrome Add to Home Screen may install the station's web app. Android Auto's on-dash browsing is a **native media app integration** requiring a MediaLibraryService/MediaSession; a web page alone isn't equivalent. Do not imply the current FM page has Android Auto registration.

## Minimum real-world test

1. Tune into the new station on mobile, press TUNE IN.
2. Drive-mode simulation: lock screen, connect Bluetooth or earbuds, verify resume/pause and media keys.
3. Leave playing for at least two album-length rotations: verify automatic continuation, no unintended repeats in SHUFFLE.
4. Open the page on two phones at the same time on SAME-TIME mode; verify roughly same song/offset, not exact sample alignment.
5. Return to the tab after backgrounding; see whether Same-Time resynchronizes.
6. Turn off Wi-Fi mid-song and back on; ensure honest error/retry behavior.
7. Confirm the original HUMKIN 12-track landing and older fictional `/radio/` project remain intact.

## Station economics

A browser-simulated rotation adds no standing server instance, though file serving, site traffic and storage have real limits. An actual live stream costs network bandwidth and an always-on host. Scaling beyond a small pilot should prioritize a stable host/relay, audio pipeline, copyright compliance and access to existing radio directories rather than buying promotion.

**The release gate for this first PR:** Only the station page and demo rotation may go live. Do **not** claim the creator's new unpublished playlist or a continuously transmitting 24/7 stream was uploaded or activated.

## Verified expansion: `everywhere;near you` (November 13)

The first additional album was already published independently at `/releases/everywhere-near-you/` with seven assembled and SHA-256 verified **web preview** MP3s. We have now included those seven in the radio rotation, making **19 total selections**: 12 from `MUTANT POP`, seven from `everywhere;near you`. Each entry declares its album, accurate file duration, relative source path and album cover. `fm/rotation.json` uses `source_type: track_list` and `status: expanded_rotation`. Playback still represents browser radio, not a remote live broadcast.

The seven new files are 64 kb/s preview encodes, materially below intended radio-quality audio, so they should be replaced with approved original-quality audio exports prior to promoting a serious broadcast or distributing the radio station to directories. The creator's separate *radio-vibes* playlist is not yet published. Updated CI assembles the verified MP3 parts before checking all nineteen actual files and shuffle/clock behavior.


## HaileyLu Bloom — 20th station song (November 13)

User explicitly supplied `HaileyLu Bloom.mp3` in the chat, original 2:27.864 MP3, 48 kHz stereo, embedded artist tag `daughtershome`, Suno song UUID `b6d91f50-f082-4e47-9dc8-56ac9ed73f36` and source URL `https://suno.com/song/b6d91f50-f082-4e47-9dc8-56ac9ed73f36`. It was staged through an authorized temporary transfer and committed **byte-identically** to `fm/audio/haileylu-bloom.mp3` with SHA-256 `1c92c36b078586a3bc795e4431dd63cec8d0733349d9d61bcec83dbc080aced6` (3,428,213 bytes). The temporary transfer import workflow was removed. The published file no longer depends on third-party CDN expiration.

The track is listed under HUMKIN as the radio artist, while the embedded original creator tag remains unchanged in the original MP3. Duration is taken from the original file, not estimated by the radio player. Existing 19 recordings remain in the mix; Road Shuffle and shared-clock mode now handle **20 songs**. A new on-page button starts `HaileyLu Bloom` and proceeds with all 19 other songs without repetition. No automated volume mastering or transcoding was applied; the user's original file remains intact.

The musical feel is laid-back, groove-led and exceptionally suitable for relaxed car listening: spare electric-key or guitar-like chord figures, rounded bass, dry backbeat, intimate vocal and memorable recurring hook. In a polished broadcast, its dynamics and transition timing should be auditioned against adjacent recordings before deploying loudness normalization.

Rights status: the creator previously reports these Suno outputs were made under Premier and not third-party remixes. This individual song's ID3 contains its Suno source and time but is not itself a definitive rights certificate. The station is still a browser radio player, not an externally regulated FM station, direct-licensed venue speaker service, or independent always-on Icecast stream.

## November 13: Leave The Kettle On

The user supplied `Leave The Kettle On (1).mp3` directly, with a Suno creation tag `created=2026-07-05T17:09:35Z; id=f3366bcc-39d5-4187-b7f9-073a7efc3dcc`. Its source file has 3,925,398 bytes and duration 173.952 seconds, SHA-256 `c855100c353b8f229c0811bf67c079f5e038dca4316b5a08a90cf10225e08d3d`. The original file was copied without transcoding, checked by GitHub Actions, and committed at `fm/audio/leave-the-kettle-on.mp3`. This increases the browser radio catalog to **21**. The new song has a bright, syncopated bass-and-keys introduction, lead fiddle-like melodic line, warm soul-pop vocal and a catchy domestic refrain. Its start/stop and inter-track volume should be field-tested before a true broadcast pipeline.

The station's `HEAR THE NEW ONE` button prioritizes the new single and then resumes repeat-free shuffle. The previous HaileyLu Bloom stays in the rotation. No radio tower or 24/7 relay has been deployed, and recorded music still needs all relevant public-performance rights before external broadcast.

## November 13: lock-screen track-continuity attempt (pending phone field test)

**Observed in `fm/radio.js` before this change:** Each song transition explicitly called `audio.pause()` and `audio.load()` before playing the next source. Chrome documents that media sessions may be considered inactive while media is loading or seeking, so tearing down the current audio element can interrupt Android lock-screen playback.

**Changed in the proposed radio fix:**

- Reuse the same `<audio>` element without explicit pause/load for an actively playing transition. Only intentionally stopped playback loads in the idle state.
- Keep `navigator.mediaSession.playbackState` at `playing` during the song swap; use `paused` for explicit stops and failed playback.
- Try an early Road Shuffle transition in the final 350 milliseconds of a track while audio is still active, with the existing `ended` event as fallback.
- Skip periodic Same-Time clock re-tuning when the document is hidden. Resume clock synchronization when visible or when the current file ends.
- Guard old `play()` promise settlements against overriding a newer track.

**Automated scope:** A simulated hidden-document test verifies that Road Shuffle changes sources without explicitly pausing/loading, Media Session reports `playing`, the `ended` fallback advances, and an explicit pause reports `paused`. This is not proof that a physical phone will execute background JavaScript.

**Acceptance test on a real Android/Chrome phone:**

1. Open `https://humkin.abundent.org/fm/` in Chrome and choose **ROAD SHUFFLE**, then **TUNE IN**. Play long enough to reach the last 30 seconds of a song.
2. Lock the screen. Confirm audio continues through *at least two* song boundaries, and that Android's media notification does not disappear. Test with and without Bluetooth.
3. Repeat for **SAME-TIME RADIO**. After unlocking, confirm it can resynchronize to the shared clock.
4. Test notification Pause/Play and physical headset or car controls. Test one forced network interruption and one battery-optimization state. Record the exact browser/Android version, mode, transition time and whether notification disappeared.
5. If either mode stalls on the first locked-screen boundary, the reliable escalation is a **single continuous HTTPS audio stream** (Icecast/AzuraCast or equivalent) or a native Android media service. Web JavaScript and Media Session metadata alone cannot force a suspended browser to execute track changes.

Do not announce verified lock-screen reliability until the device test is completed. `live_stream_url` remains `null`; no true broadcast server was created by this change.

## November 14: track-boundary gap + late-start fix

An Android listening test exposed two problems. First, ordinary Same-Time RADIO track changes called `startClock(true)`, using the wall-clock offset *after* MP3 load latency, so a new song could begin 18 seconds in. The 12-second clock checks and visibility-change handler could also forcibly skip while music was already playing. Second, Android/Brave can suspend background JavaScript so the website cannot guarantee that the `timeupdate` or `ended` callback will run while the screen is locked.

**Browser improvements (PR #30):**
- On initial TUNE IN (and explicit CATCH UP), shared-clock seeking remains optional and expected. **Automatic song changes now start at 0 seconds**, following a theoretical slot boundary instead of real-time network lag.
- Remove periodic unsolicited clock re-synchronization and the foreground unlock jump; these were causing audible skipped song introductions.
- While each song is playing, bounded-prefetch the next public MP3 (up to 18 MiB), storing it in a temporary Blob URL for faster transition. The code aborts abandoned requests, releases old Blob URLs, and falls back to direct MP3 URLs if CORS/bandwidth/data-saver disallows prefetch. This improves readiness but cannot guarantee a zero-gap transition or background JS execution.
- `PHONE PLAYER PLAYLIST` creates an Extended M3U file using approved, currently enabled public track URLs. Open `HUMKIN-RADIO.m3u` in VLC Android or another native playlist-capable media app. Native players own the media queue and generally handle locked-screen song changes more reliably than suspended browser JavaScript. **The M3U is a downloadable URL list, not offline MP3 media, nor a synchronized live broadcast**; any programmed show schedule is not embedded.
- A continuous HTTPS Icecast stream remains the only robust way for the *browser* radio to play the same program in the background without executing JavaScript per-song.

No catalog or station settings changed. Validate in Android/Brave and Chrome with 3 successive boundaries (foreground and locked screen), and separately validate opening the M3U in VLC. Browser playback remains subject to mobile policy and network performance.
