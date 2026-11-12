# HUMKIN — MUTANT POP · GitHub Pages release candidate

The official free-to-listen, free-to-download player for twelve original HUMKIN tracks. The public Pages target is **https://the-static-collective.github.io/HUMKIN/**.

## Release status
This branch contains a complete static **HTML / CSS / JavaScript player**, an editable song manifest and the HUMKIN RADIO three-channel interface. **The 12 actual MP3 assets and album artwork must be uploaded before merging or advertising this as a working full-album site**. The existing full-size, web-optimized audio files and art are already packaged in the owner's `HUMKIN_PUBLIC_PLAYER_SOURCE.zip` (31.5 MB). No audio is fabricated, remotely proxied, or represented as verified on Pages by this branch.

## Publish
1. Upload the 12 `audio/*.mp3` files and `cover.jpg` from the prepared ZIP into this branch, retaining paths/case exactly.
2. Open `https://the-static-collective.github.io/HUMKIN/` after merging the PR to `main`, with GitHub Pages configured to publish `main` /`(root)`. No Node or build step is needed.
3. Verify all 12 play, skip/shuffle/repeat, per-song direct downloads and `/radio/`. The tracks use relative URLs so the GitHub Pages subpath and a later verified custom domain both work.
4. When migration is verified, configure `humkin.abundent.org` under GitHub Settings → Pages and adjust DNS. Do not assume the existing Vercel site has migrated merely because Pages settings changed. Add a `CNAME` only in the verified custom-domain cutover.

Provenance: the original full-quality private submission masters, original metadata and licensing evidence stay untouched. The public player contains web-optimized listening encodes only. No analytics, tracking, autoplay, sign-in or paid features. The radio is on-demand fiction, not a live broadcast or first-listen AI DJ session.
