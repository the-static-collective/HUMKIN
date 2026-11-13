# HUMKIN deployment checkpoint — 2026-11-12

**Goal:** Publish the full 12-track MUTANT POP player and HUMKIN RADIO from `the-static-collective/HUMKIN` via GitHub Pages at `humkin.abundent.org`.

## Why previous launch attempts seemed to fail
- The previous GitHub `main` branch contained only a README; there was nothing for Pages to serve as a site. The site and workflow were in draft PR #1.
- The prior live-looking `humkin.abundent.org` was a separate Vercel **preview microsite** (three song previews), not the new full-length Pages player.
- Full MP3 assets arrived on the draft branch in its second commit on Nov 12, but the PR description still said media was absent. The album art was still missing.
- The Cloudflare DNS CNAME for `humkin.abundent.org` continued targeting Vercel even after the GitHub Pages deployment was staged.

## Actions completed in the subsequent recovery
1. Confirmed **all 12 MP3s** exist in the draft branch's `audio/` directory (each roughly 2.1–2.7 MB).
2. Imported the original 1080×1080 album artwork from the owner's saved `cover-b64.html` asset as `cover.jpg`.
3. Refreshed the README and PR description to reflect actual assets, marked PR #1 ready, and **squash-merged** it into main.
4. Merge commit: `6680f5cc1669d8e9dfaed9c1f26fbd726a7049af`.
5. GitHub Actions Pages deployment **succeeded**: https://github.com/the-static-collective/HUMKIN/actions/runs/43333300856 (deployment artifact 31,473,713 bytes).
6. Changed only the **humkin** Cloudflare DNS CNAME from `fce1b9caa8ebee11.vercel-dns-017.com` to `the-static-collective.github.io` (DNS-only, other records untouched).
7. Confirmed fresh HTTP loads at `http://humkin.abundent.org/` show the new full-album page with twelve tracks, and `http://humkin.abundent.org/radio/` serves the new radio.

## Remaining verification gate
- **HTTPS was not accepting connections immediately after DNS cutover.** The Pages deployment log showed `http://humkin.abundent.org/` as the environment URL. Check the GitHub Settings → Pages custom-domain certificate status, and enable **Enforce HTTPS** after the certificate provisions. Do not claim secure HTTPS until re-tested.
- Test **actual in-browser MP3 playback** (not just rendered tracklist), multiple song downloads, share URLs, and a radio channel. The Git tree contains real MP3 blobs and the Actions bundle includes them, but listening from a consumer browser was not independently verified here.
- On success, revise release links / distribution pitches to the secure URL and clear the previous launch HOLD.
- If a rollback becomes necessary, the old exact Cloudflare CNAME target is documented above; avoid altering apex or any other subdomains.

This status document exists to prevent another conversation from reconstructing the same release process from incomplete staging notes.
