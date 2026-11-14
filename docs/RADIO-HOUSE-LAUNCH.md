# HUMKIN RADIO HOUSE — actual-station convergence (14 November 2026)

## Verified source lineage (not a merger)

This work reviewed the actual source files and prior PRs before choosing the composition. **The three source worlds remain distinct.** The radio-world directory at `/fm/network/` represents their historical contribution to our engineering, not a new Kinship/Rock Impact partnership and not permission to use their media.

### Kinship Radio, Minnesota — human editorial law

Source: [KINSHIP-001](https://github.com/the-static-collective/static-live/blob/main/docs/KINSHIP-001.md), [KINSHIP-002–005 Fall Share Room](https://github.com/the-static-collective/static-live/blob/main/examples/kinship-fall-share-room/README.md), plus the [HUMKIN Living Discography integration](https://github.com/the-static-collective/HUMKIN/pull/31) already deployed at `/fm/living/`.

Reusable, now:
- `observed | derived | interpretation | metaphor` claim modes, explicit sources and human-review disposition.
- The working distinctions `READY ≠ AIRED`, `recorded ≠ approved`, `reviewed ≠ broadcast`; operator must confirm an actual on-air event.
- Source refs, permission document ref, exact media file review, campaign clocks, producer handoffs, return log; `KEEP | WEIRD | COMPOST` station memory.
- Kinship's public community calendar, volunteer program, prayer systems and official contributions **stay Kinship-owned**. Never ingest private prayer requests, payment/donor records or volunteer screening records into HUMKIN.
- If producing independently inspired community reports on HUMKIN: use publicly verifiable current facts, consent, a human reviewer and a **HUMKIN** recording. A Kinship-hosted audio recording is **not** a permitted HUMKIN asset without separate permission.

Kinship remains an independent station. No live media/syndication partnership is claimed.

### Rock Impact Makers International, Nigeria — production/preservation law

Sources: [STREAM-001 OBS console design](https://github.com/the-static-collective/static-live/blob/main/docs/superpowers/specs/2026-09-18-stream-001-static-broadcast-console-design.md), [synthetic STREAM-001 demo](https://github.com/the-static-collective/static-live/blob/main/examples/stream-001/README.md), [GHoT Radio House 003 PR #103](https://github.com/the-static-collective/GHoT/pull/103), [GHoT Radio House 004 PR #106](https://github.com/the-static-collective/GHoT/pull/106), [RADIO WORLD 001 PR #35](https://github.com/the-static-collective/static-live/pull/35), and [official Rock Impact Makers website](https://rockimpactmakersglobal.org/).

Reusable:
- Single operator surface `GO LIVE → CHANGE SCENE → END + PRESERVE`.
- OBS preflight, explicit scenes and state, required local recording **before** starting a live stream.
- Network outage may enter `RECORDING_ONLY`, not destroy an existing source recording. Honest receipts say what actually streamed and what did not.
- GHoT media-first compute pauses optional background work while production/recording is active, but the radio-house proposals are open/unmerged and **no actual Minnesota–Nigeria stream was performed**.
- **No Rock Impact audio, sermons, service stream or voice recordings** have been imported by this work. Their ministry and editorial/rights authority remain independent.

### HUMKIN RADIO — the independently owned station

Already operational: `/fm/` browser radio, cloud and original catalog, cover shelf, station-manager scheduling, 42% warm analog texture/92 BPM pulse, per-device hourly shuffle memory, shared-clock approximate synchronization, `/fm/studio/` private cart machine, and `/fm/living/` local Kinship-derived producer memory. Existing `tools/radio-broadcast/engine.py` provides an **offline-tested** continuous Icecast source, but has not been connected to a live host.

This PR adds:
- `/fm/network/`: public evidence-linked, **permission-bound** three-world directory. Open independent official sources; never proxy or rebroadcast their audio.
- `fm/hosted-nowplaying.js` and radio player support for public AzuraCast now-playing title, art and aggregate listener count **after** a verified hosted stream is connected. Until then both configured endpoints remain `null` and existing browser radio continues unchanged.
- `tools/radio-broadcast/host_preflight.py`: read-only test for HTTPS live MP3/AAC response **and** online AzuraCast station status. Separate stream and API hosts allowed. Fails closed if stream is not actually returning audio or station reports offline.
- `tools/radio-broadcast/azuracast_media_bridge.py`: generates a rights-review manifest of published HUMKIN-only MP3 URLs; can transfer **exactly one** source recording to an authenticated hosted AzuraCast station **only** after human clears internet-radio rights with a non-sensitive permission reference and explicitly confirms.
- Manual GitHub workflows `radio-host-preflight.yml` (public URL check) and `azuracast-one-track.yml` (secrets + rights gated; never automatic). Workflows can run in GitHub cloud; **no home computer** necessary.
- Offline CI tests for the registry, rights checks, preflight, metadata parser and upload packet.

## What “actual radio” still requires

A real Internet radio station is **one independently running audio transmitter**, not one playlist simulation per phone. No hosting subscription has been purchased and no public stream has been enabled by this PR. A hosted AutoDJ/Icecast service is the cleanest choice while there is no reliably homed computer.

### Hosted transmitter options checked (14 Nov 2026)

- Managed AzuraCast from **Radiocast** advertises a **Professional $5.99/month** tier with 24/7 AutoDJ, approximately 10 GB storage and up to 100 concurrent listeners, plus access to a genuine HTTPS broadcast URL. Their published plan details vary by product page; confirm **API permissions**, limits, terms and checkout costs before purchase. https://radiocast.net/hosting/managed-azuracast-hosting
- Zeno.FM Starter currently lists **$28/month**, 500 AutoDJ recordings and 128 kbps; its free streaming tier ended January 2025. The current Zeno terms contain extensive content licensing and AI/data provisions; review carefully before placing privately meaningful recordings there. https://new.zeno.fm/pricing/
- A self-hosted AzuraCast VPS or the experimental Modal worker is possible, but **Modal on-demand audio renders are not a replacement for a low-cost, professionally monitored continuous AutoDJ host**. A local machine is a later option, not a blocker.

Recommended first hosted step: one inexpensive managed AutoDJ station, station name HUMKIN RADIO, one owner-reviewed HUMKIN recording, HTTPS listening URL, public AzuraCast now-playing URL. Do not upload Kinship or Rock Impact media.

### Phone-only deployment steps

1. In a hosted AzuraCast service, create the independent station and AutoDJ. This requires the user's own provider sign-up and subscription; ChatGPT cannot purchase or assume a new station exists.
2. Create an AzuraCast API key inside the host account if the plan offers it. **Keep it in GitHub repository secrets, never in website code, chat, a public issue or a PR.** Set `AZURACAST_HOST_URL`, `AZURACAST_STATION_ID`, `AZURACAST_API_KEY` in HUMKIN GitHub Actions Secrets.
3. Verify one HUMKIN recording's internet-radio rights. From the GitHub Actions page manually run **HUMKIN Radio → hosted transmitter (one approved track)** with exact public track ID, a **non-sensitive** rights reference, and exact owner confirmation `I_CONFIRM_HUMKIN_BROADCAST_RIGHTS`. The workflow transfers only that track, assuming the installed host API version supports the documented JSON/base64 endpoint. If the API fails, use the provider's ordinary media-upload interface; do **not** circumvent rights or publish credentials.
4. Put the approved recording into AutoDJ, turn on the hosted station, then obtain its **public listener URL** (not password-bearing source URL) and `https://HOST/api/nowplaying/HUMKIN_SHORTCODE`. Test using the manual **Check a real HUMKIN Radio cloud transmitter** workflow (or `python3 tools/radio-broadcast/host_preflight.py --stream-url ... --nowplaying-url ...`).
5. Only after the endpoint returns real audio and reports online, submit the two **public** URLs to update `fm/rotation.json`:
   ```json
   "live_stream_url": "https://VERIFIED-HOST/listen/humkin/radio.mp3",
   "live_nowplaying_url": "https://VERIFIED-HOST/api/nowplaying/humkin"
   ```
   The above are **synthetic examples, not actual working HUMKIN endpoints.** The Radio player will then use the real shared stream in Same-Time mode; Road Shuffle remains local and separate.
6. Verify phone/desktop simultaneous playback and lock-screen switching against one source. The hosted service performs the program transition, not suspended browser JavaScript. Note that Internet radio players may buffer differently; “one source” does not imply zero receiver latency.
7. Introduce approved bumpers, shows and community reports through Station Manager and Studio. Avoid automatically treating Kinship/Rock Impact official programming as available HUMKIN audio. Track exact licensing/consent for any cross-station clips.

## Proof gates / no false claims

- **Source registry:** reviewed reference documents and official sites. It proves **project lineage**, not anyone's endorsement.
- **Prepare:** local HUmKIN catalog and private carts; no on-air event inferred.
- **Rights:** HUMKIN owned/or licensed radio-use approval must be documented; even personal source ownership may not cover all composition/public-performance rights.
- **Record:** Rock Impact-style preservation receipts for actual live human sessions remain a future studio feature; our UI does not claim OBS is connected.
- **Air:** hosted station must be really online, audio reachable over HTTPS and human-confirmed. Existing Kinship-derived station-memory tools must never mistake proposed programming for aired programming.
- **Return:** human-reported observations may guide future programs, not automatically change truth or editorial authority.

The public Radio House is **not** a Kinship or Rock Impact streaming portal. It is an independently operated HUMKIN radio-station engineering and source-provenance room.

## Maintenance

Config keys remain `null` until explicitly verified. No new Supabase secrets are copied into public JS. The provider preflight uses public HTTPS only. No audio or playlists were uploaded into hosted third-party services in this PR. GitHub Actions upload workflows remain manual, scoped to exactly one recording and require configured owner credentials/rights confirmation.
