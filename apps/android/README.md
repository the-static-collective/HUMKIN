# HUMKIN RADIO Android · v0.5

The native Radio screen now borrows the published HUMKIN site's dark-ink
masthead, yellow station ticker, warm paper dial, high-contrast buttons and
pink accents. The illustrated albums and skyline remain native and offline.

**Radio-only analog static:** an opt-out, softly filtered local PCM hiss is
synthesized by the Media3 playback service after the user taps Tune In. Its
37.8% website-style texture is reduced by 4.2%; it runs only while Same-Time
Radio is actually playing and ready, including with the screen locked. It
pauses for buffering, audio interruptions and pauses, and is disabled outright
for Road Shuffle and albums. The ON/OFF setting persists per device. Static
never replaces or processes a music stream, and adds no network calls,
accounts or permissions. Analog crackle and website-only signal-drop effects
are not ported in this pass.


The Radio and Albums screens use the paper-style reference artwork, including the
station masthead, illustrated covers, and skyline. The text and controls are
native Android views. The album shelf switches from two columns to one on
narrow screens or with larger system text.

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
- Screen artwork ships in the APK. The lock-screen media session still uses the
  artwork links in the published station and album metadata.
- No sign-in, advertisements, tracking, offline bulk downloads, media file
  packaging or additional runtime permissions.

## Device acceptance
Run `gradle -p apps/android :app:assembleDebug :app:testDebugUnitTest`.
On device verify:
1. The cream/ink/yellow UI scales at 320–420dp and scrolls with readable labels.
2. Tune both radio modes, then visit ALBUMS and return without losing playback.
   Next Record is available in Road Shuffle. Catch Up to Air follows Same-Time Radio.
3. PLAY either album; test sequential playing on the locked screen and
   the next-track control; test switching back to radio.
4. Verify fallbacks on slow/no network, theme colors and cover loading.
5. Confirm the three-song station ID cadence still comes from backend config.
6. Toggle ANALOG RADIO STATIC on Same-Time; check audible low-level hiss, pause,
   lock screen, phone interruption, buffering, and that **no hiss** follows into
   Road Shuffle or album PLAY. Persist preference across app restarts.

This is an unsigned-for-store debug build; Google Play developer enrollment,
physical receiver tests, and production signing are still pending.
