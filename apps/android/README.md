# HUMKIN RADIO Android · v0.3 visual pass

Approved visual direction implemented as real Java native UI, not a WebView or screenshot:
warm cream canvas, plum now-playing console, yellow/mint/pink controls,
rounded station buttons, landscape artwork fallback, actual remote album
covers, mode cards, large ALBUMS button, separate native album shelf.

## Tested/working in source
- Native SAME-TIME and ROAD SHUFFLE retain v0.2 behavior.
- ALBUMS has two verified published manifest sources:
  * MUTANT POP — 12-song album (root `tracks.json`);
  * everywhere;near you — 7-song album (`releases/everywhere-near-you/tracks.json`).
- Each album's PLAY fetches its public track manifest and hands native
  Media3 a complete album playlist; background audio and lock-screen controls
  use the **existing** player service.
- Warmth and Singles cards route to radio modes instead of pretending they
  have a published standalone album manifest. Dedicated Warmth and singles
  library pages can be wired when their real source manifests are available.
- Album page and radio mode navigation preserve active playback. Returning
  to radio does not interrupt an album until a listener actively tunes.
- The privacy and fictional archive open the existing public site.
- All artwork downloads are strictly HTTPS from humkin.abundent.org;
  unverified media falls back to the locally drawn sunset, never an empty box.
- No sign-in, advertisements, tracking, offline bulk downloads, media file
  packaging or additional runtime permissions.

## Device acceptance
Run `gradle -p apps/android :app:assembleDebug :app:testDebugUnitTest`.
On device verify:
1. The cream/plum UI scales at 320–420dp and scrolls with readable labels.
2. Tune both radio modes, then visit ALBUMS and return without losing playback.
3. PLAY either album; test sequential playing on the locked screen and
   the next-track control; test switching back to radio.
4. Verify fallbacks on slow/no network, theme colors and cover loading.
5. Confirm the three-song station ID cadence still comes from backend config.

This is an unsigned-for-store debug build; Google Play developer enrollment,
physical receiver tests, and production signing are still pending.
