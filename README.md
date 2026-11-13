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
