# Cloud HOUSE Schedule Viewer — approved-direction build specification

## User outcome
Anyone, especially the owner on mobile, can see the already-published Cloud HOUSE running order and when songs are planned to play without navigating Cloudflare R2 or GitHub Actions JSON. This is not a playlist editor or a guarantee of sound actually heard.

## Approach
Selected implementation default: add a read-only, sanitized public schedule endpoint to the current Long Wave/Cloud Autopilot Worker and a static GitHub Pages page at `/fm/schedule/`, linked from existing radio pages. Alternatives considered: direct public R2 object exposure (leaks implementation media paths and ties users to raw JSON) and a second independent schedule database/editor (conflicting authority). Reuse the same R2 pointer and clock instead.

## Scope
Public metadata projection; exact schedule timestamps including revision boundaries; accessible mobile list and artwork; local/UTC toggle; refresh and failure states; tests and operator notes.

## Safety and non-goals
No writes to R2, Supabase, media, cloud pointers, station settings, credentials, Android playback or live fallback. Retain the existing manual Cloudflare Worker deploy gate. Never label a published schedule as confirmed heard.

## Evidence and release
PR unit tests must verify route correctness, no private fields, read-only method gate, media-incomplete warning, revision transitions, client content validation and static navigation. GitHub Pages site may publish on merge. Worker deployment requires a separate owner-confirmed manual GitHub Actions dispatch and subsequent field verification.
