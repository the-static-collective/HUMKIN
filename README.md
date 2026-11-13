# HUMKIN — MUTANT POP

Free-to-listen, free-to-download player for the 12-song *MUTANT POP* album, with an on-demand HUMKIN RADIO companion.

**Repository:** the-static-collective/HUMKIN  
**GitHub Pages preview:** https://the-static-collective.github.io/HUMKIN/  
**Intended custom domain:** https://humkin.abundent.org/

## Release state (November 12, 2026)
- All 12 web-optimized full-length MP3 files are present under `audio/`.
- The 1080×1080 album cover is present as `cover.jpg`.
- `index.html`, `player.js`, `styles.css`, `tracks.json` and `radio/index.html` are present.
- `.github/workflows/deploy-pages.yml` deploys automatically when commits reach `main`.
- **The public URL and audio playback must be checked after the first successful deployment.** Files in Git alone do not establish that Pages or a custom domain is live.

## Publish and check
1. Merge the release branch to `main`.
2. In GitHub Settings → Pages, set Source to **GitHub Actions** (not “Deploy from a branch”).
3. Confirm Actions → “Deploy HUMKIN to GitHub Pages” succeeded. Open the Pages preview URL above.
4. Test at least two song starts, all 12 audio URLs returning MP3s (not HTML), direct downloads, next/previous, share links and `/radio/`.
5. Only once the preview works, assign the domain `humkin.abundent.org` in Settings → Pages, add `CNAME` containing exactly `humkin.abundent.org`, and configure the DNS CNAME record for the subdomain to `the-static-collective.github.io` at the domain's DNS host (delete conflicting records). Confirm HTTPS and playback at the custom domain.
6. Keep an older publication until the cutover is independently verified.

This static site has no paid services, app accounts, analytics, tracking or autoplay. Original private masters and supporting rights documentation remain separate. Public audio files are optimized listening encodes, not masters. Recording rights and third-party commercial licensing must be confirmed for each relevant use.


## HUMKIN v2 — The Little Human Machine (November 12, 2026)

Live site: https://humkin.abundent.org/

The main page now also includes:
- **Find a song**: five mood choices that immediately play one of the 12 album tracks.
- **Three-song postcards**: select three different tracks, add an optional short note and color, preview the postcard, then use native share or copy its URL. Received postcards display before any playback; the existing sticky player plays the three tracks in order and stops after the third.
- **Privacy**: postcard selections and text are carried only in the shareable URL; there is no postcard server/database. Messages are visible to link recipients and may be recorded by link-sharing services, so don't put secrets in them.
- **Pocket record**: installable web app manifest plus service worker for basic offline shell. Full album caching is an explicit visitor action; it may use around 30 MB of storage and depends on browser support. Normal individual MP3 downloads remain available.
- **Free printable poster**: `/poster.html` has a locally rendered QR code pointing to the main site, with no remote QR API.
- **Reduced-motion-friendly cover animation** during playback.

No automatic audio downloads or autoplay were introduced; radio remains unpromoted. Existing HUMKIN Letters subscription storage and privacy policy remain separate. GitHub Actions `Validate HUMKIN site` checks JS syntax, page bindings, 12 local MP3 assets and postcard inputs. GitHub Pages deployment is from main.

### Sharing format
- Individual track links: `?track=05`
- Three-song gift: `?mix=01.05.09&card=sun&note=Thinking%20of%20you`
- Links deliberately contain no recipient name, email or account identifier.

### Tests / limitations
- PR #3 validation workflow passed and Pages deployed after merge.
- The live HTML and printable poster were independently fetched. Automated interactive-browser testing was unavailable at release time; actual in-browser audio, mobile sharing, PWA install and full offline save still merit field testing.

## HUMKIN distribution station — November 13, 2026

**Put HUMKIN Somewhere:** `/somewhere.html` (also linked from home navigation, hero, and note).

The station combines five working tools, built on the existing 12-track public audio and postcard-art manifest:

1. Five suggested listening rooms with three-song audio queues, shareable room URLs, personal MP3 downloads and a clear public-business-playback rights warning.
2. One-track, three-track, and whole-album `/embed.html` players with an instantly generated iframe snippet, copy fallback, and a live preview. No autoplay or tracking code.
3. Music-for-creators licensing inquiries, prefilled with the current tracks; emails are drafts until the user sends them. Free downloads **do not** automatically grant film, public-performance, broadcasting or redistribution licenses.
4. New random manga postcard links using existing published artworks, native sharing and copy fallback, plus the existing locally generated QR poster for real-world placements.
5. `/discovery.json`, the public `/tracks.json`, and `/docs/DISTRIBUTION.md` for machine-readable music discovery and integration.

There is no invented adoption registry or backend tracking. Real placement receipts are currently voluntary messages to `us@abundent.org`. Prior in-browser home player, original postcards, and mailing list are preserved. The offline shell cache is upgraded to v6 to avoid the stale-JavaScript button bug. `tests/distribution.test.mjs` exercises room and embed controls, copy and share flows alongside the pre-existing postcard and site tests.

### Publishing and licensing gates

Run all three Node tests, merge the PR, verify GitHub Pages Action, then verify **HTTPS** and actual user-initiated audio on `humkin.abundent.org`. Publishing a player is not proof of performance licenses for public spaces. Each proposed creator/business reuse must receive its own rights clearance. Refer to `docs/DISTRIBUTION.md`.

### Physical + embed propagation extension (Nov 13)

Six-up printable take-one cards: `/relay.html`, with the already-tested local no-remote-service QR for the home page. Every embeddable player now has a small **GET THIS PLAYER** link back to the station, so one installation can inspire another without collecting visitor data. Station links to both the existing full poster and six-up cards. Offline shell updated to v7.


## Landing-page arrangement — Walmart submission gate (November 13, 2026)

Keep **https://humkin.abundent.org/** as the existing full 12-track *MUTANT POP* player and artist landing page **through at least the Walmart music submission**. Do not redirect the homepage to the distribution station, replace the album hero, or replace the full player during this period. The separate standalone distribution station lives at **https://humkin.abundent.org/somewhere.html** and remains reachable from the homepage navigation, hero and note section. Do not treat the Walmart submission as complete without actual submission evidence and a separate editorial decision to change the landing experience.

The regression test in `tests/site.test.mjs` guards against unintentionally replacing the home album/player or collapsing the separate station into it.

## Little Music Relay — November 13, 2026

**New standalone surprise-song page:** `https://humkin.abundent.org/surprise.html`. The existing six-up printable cards `/relay.html` now send QR visitors to that page rather than the album homepage. Every new visit without a song selection finds a random HUMKIN track and one manga illustration; playing is explicit, and **KEEP IT / SEND IT / FIND ANOTHER** produce a personal MP3 link, a permanent shareable song/art URL, or another gift. The main album `/` remains untouched until at least the Walmart music submission, and the distribution station remains at `/somewhere.html`.

**Rights readiness:** `docs/RIGHTS-INVENTORY.md` includes every MUTANT POP track with public source references. All are marked **not yet cleared for new direct business or creator licensing** pending source, paid-plan/download, composition, recording, PRO and distributor rights verification. The personal listening relay is not represented as commercial venue music authorization.

**Operations:** The service worker shell is bumped to v8 and caches the new page's assets. `tests/surprise.test.mjs` exercises gift generation, playback, sharing and browser navigation as part of GitHub Actions. The existing full-album poster still routes to the Walmart-safe homepage.

## DJ Desk / downloadable DJ starter crate — November 13, 2026

A dedicated `/dj.html` route offers existing MUTANT POP 12-track MP3s directly to DJs, with on-page auditions, individual downloads, a real deploy-generated `/dj-pack.zip` containing the twelve MP3s, a local-path `/dj-crate.m3u8`, a metadata `/dj-crate.csv`, and `docs/DJ-PERMISSION.md`. Build tool `scripts/build_dj_pack.py` runs before GitHub Pages deployment; CI tests verify its contents. The ZIP is **not** pre-cached. WAV masters, extracted stems, BPM and keys are not fabricated and await real supplied assets.

No-fee DJ use is offered only insofar as HUMKIN controls the applicable rights. Venues/streaming/broadcast have separate licensing rules. The creator reports Premier creation and no third-party remixes, recorded in the rights inventory. Suno-approved download/composition/venue checks remain for expanded licensing.

**Walmart protection:** The homepage remains the full album/player, with only a small DJ nav link. The distribution station links the DJ portal separately. High-bandwidth DJ ZIP downloads may eventually require object storage rather than GitHub Pages' 100GB/month soft limit.
