# Acer Tower -> HUMKIN Cloud Catalog 001

## Verified starting state, November 20, 2026

The connected humkin_radio_tracks table showed 197 registered records, 187 enabled and published in R2, zero private R2 drafts and zero unpublished rows. Those are cloud catalog counts, not a physical Acer inventory. The Cloud Autopilot AAC/HLS house schedule is separate from the public catalog.

## Existing owner-only Crate Loader path

1. Open https://humkin.abundent.org/fm/load/ in Chrome or Edge on the Acer. Sign in using the existing HUMKIN owner credentials.
2. Under Desktop folder reader choose the Windows folder located at %LOCALAPPDATA%\HUMKIN\Tower\media. The browser file chooser may accept that path in its address bar.
3. The page pairs SHA256-named original audio and matching JSON sidecars. It restores original title, artist, album and source-verified duration, and reports matching or invalid metadata. Merely selecting a folder does not upload.
4. Review selected tracks and correct editorial metadata. Frequency-specific Tower display overlays may not be stored in the source JSON and may still require correction.
5. When the private R2 service reports READY, choose STAGE DIRECTLY TO PRIVATE R2. Existing owner-session authorization, object-scoped upload URLs, server-side checksum verification and exact-hash duplicate detection remain in force. Each new item stays unpublished until separate review. Do not suspend the computer during uploads.
6. Inspect the drafts and deliberately approve chosen recordings only after rights and metadata review. The songs/singles bulk approval button is a separate explicit action. Spoken bumpers require individual review.
7. After approval, songs enter the regular public HUMKIN R2 library. To make them part of the independent Night Shift shared clock, separately prepare and explicitly publish a reviewed HOUSE through the existing Cloud Autopilot workflow.

## Important limits

- The loader sees only folders the owner selects in the browser. This work does NOT count or inspect all files on the physical Acer remotely.
- Tower imports are stored in a hash-named media folder with metadata JSON. Other original music folders on the Acer must be selected separately.
- The browser path currently accepts MP3, WAV and M4A. Tower may also contain FLAC, AAC, OGG, OPUS and AIFF; these are reported as unsupported for this browser route. Convert those into separate MP3 listening copies with the existing tools/humkin-radio-batch.py and FFmpeg, retaining the originals unchanged.
- Large WAV/M4A/MP3 assets over the current private R2 transfer cap need an owner-approved MP3 conversion before this browser workflow.
- The JSON path field is never used to open files or publish anything. The browser reads only selected File objects. Before staging SHA-named audio, its actual source bytes must match the SHA256 filename. A mismatch refuses that recording. Missing valid sidecars require the user to edit its title explicitly.
- Duplicate cloud songs with the same bytes but different names remain one content hash; artist and title metadata must be reviewed.
- No R2, cloud schedule, website default source, or local source audio is modified by this pull request alone.

## Proof checklist for the actual Acer run

Record: selected Tower audio count; recognized metadata pairs; file format rejects; skipped cloud duplicates; private R2 staged count/bytes; separately approved public count; final catalog count; then an independent shared-clock/receiver test. Do not call a recording AIRED because it was merely staged or published.

## Sources

Repository: tools/radio-broadcast/tower_library.py, fm/load/loader.js, fm/load/tower-sidecars.mjs, supabase/functions/humkin-r2-direct/index.ts, docs/NIGHT-SHIFT-HOUSE-003.md.
