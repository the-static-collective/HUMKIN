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
