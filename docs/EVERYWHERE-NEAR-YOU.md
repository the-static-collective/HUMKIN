# HUMKIN — everywhere;near you — release gate

**Status:** Preview media and cover staged; full release approved for publication of the standalone listening room. This is separate from commercial distributor submission, which still requires verified masters and rights metadata.

The user-approved seven-song sequence is a fluid repeating album experience. The main MUTANT POP homepage must remain intact for the pending Walmart submission, per `README.md`. This release has its own route `/releases/everywhere-near-you/`, with user-started playback, seven-song order, and repeat toggled on by default. No autoplay.

## Album metadata

- **Artist:** HUMKIN
- **Title:** everywhere;near you
- **Track sequence:**
  1. Home With You — 2:59
  2. Rose Mary Water — 3:16
  3. Hopeful Resilience — 2:17 (instrumental)
  4. Blue Night Morning Bloom — 2:34
  5. Lovely Blue Bloom — 3:02
  6. There by Two — 2:47
  7. Blue Bowl Rings — 3:32
- **Total:** 20:27 based on supplied file durations.
- **Release type:** Artist describes this as an EP. DistroKid says 7+ tracks are generally classified as an album by stores.
- **Production masters:** Not yet supplied/verified. The seven chat MP3s contain 64 kb/s audio streams; do not transcode the lossy streams to WAV and misrepresent them as lossless distributor masters.

## Media files for the website

The approved cover is staged at `releases/everywhere-near-you/cover.jpg`. The seven correct preview MP3s are stored as verified binary Git parts in `audio/.parts/`; `scripts/assemble-everywhere-near-you.mjs` concatenates and validates them during CI and GitHub Pages deployment. The seven published paths are:

- `releases/everywhere-near-you/cover.jpg` — manga release cover, square, from the approved image.
- `releases/everywhere-near-you/audio/01_home_with_you.mp3` — **correct** 2:59 recording from `Home With You (1).mp3`, **not** the other 4:03 recording.
- `releases/everywhere-near-you/audio/02_rose_mary_water.mp3`
- `releases/everywhere-near-you/audio/03_hopeful_resilience.mp3`
- `releases/everywhere-near-you/audio/04_blue_night_morning_bloom.mp3`
- `releases/everywhere-near-you/audio/05_lovely_blue_bloom.mp3`
- `releases/everywhere-near-you/audio/06_there_by_two.mp3`
- `releases/everywhere-near-you/audio/07_blue_bowl_rings.mp3`

The preview file byte sequences and artwork checksums are tested on the PR before publication. The separate complete release kit remains available in the conversation. Do not confuse this preview publication with DSP distribution.

## Before publishing / distributing

1. Verify rights for *each* AI-assisted recording, including Suno generation date, relevant paid subscription, permitted downloads, remixes, voices, third-party samples and human contributions. Current Suno commercial permissions depend on its specific terms and compliant downloads.
2. Retrieve approved lossless masters. Distributing the 64 kb/s chat MP3 previews is discouraged.
3. Fill missing songwriter/collaborator legal names, release date, explicit flags, genre, existing ISRCs (if any), and any preexisting distributor obligations.
4. Verify the square artwork against distributor standards. The 3000px JPG exported from the 1254px original is an upscale, not new source detail.
5. Confirm actual live/mobile playback of all seven tracks after deployment, deep-link `?track=07`, next/previous, repeat on/off, no autoplay, working artwork, HTTPS, and no broken links. GitHub Actions assembly and repository tests are necessary but not sufficient.
6. Do not redirect or replace the main HUMKIN landing page before the Walmart submission. A separate listening room may be published at `/releases/everywhere-near-you/` without changing existing navigation. Add a discreet cross-link only after actual live verification and when the submission-sensitive front page may change.

**Business placement:** A personal listening URL, public MP3, or QR card is not an automatic business public-performance license. Follow the separate `docs/RIGHTS-INVENTORY.md` gate and venue-specific clearance.

## Sources

- DistroKid format and album classification: https://support.distrokid.com/hc/en-us/articles/55115193705875-Singles-EPs-and-albums-which-format-should-you-release-on-DistroKid
- DistroKid AI uploads: https://support.distrokid.com/hc/en-us/articles/41182362733715-Can-I-Upload-Music-Made-With-AI-Tools-to-DistroKid/
- DistroKid artwork: https://support.distrokid.com/hc/en-us/articles/360013534334-What-Are-the-Requirements-for-Album-Artwork
- Suno current terms: https://suno.com/terms
- Suno paid-plan rights FAQ: https://help.suno.com/en/articles/9601665
