# HUMKIN RADIO Android · v0.9

## Listener-first receiver / install recovery

**Install this build as `HUMKIN RADIO · REAL ART`**, a separate Android
package `org.abundent.humkinradio.realart`. This is a **new test identity**
so Android can install it beside v0.7 Field Test and v0.8 Receiver, whose
ephemeral CI signing keys cannot be reused. GitHub runners may generate
different debug signing keys on each run; Android refuses to replace an
installed same-package build signed with a different key ("App not installed").
The field-test package has its own identity, so it can be installed alongside
a previous HUMKIN RADIO debug APK without removing the older receiver.
Install the file `app-fieldTest.apk` from the CI field-test artifact.
**Previous Field Test or Receiver builds cannot be upgraded in place** if
their debug signing keys differ. The new v0.9 app starts with separate local
preferences/history. Keep the older app until v0.9 is confirmed working.
Once verified, the user can uninstall old test variants manually. Further repeatable upgrades require a securely
stored permanent signing key; do not distribute a development keystore publicly.

This is a **one-time compatibility workaround**, not stable production signing.
Subsequent field-test upgrades can still hit the signature conflict if CI uses
a new ephemeral key. A permanent protected keystore and production signing
process are needed before a public/store release. If installation still fails,
check the Android unknown-apps permission, device storage, complete download,
and the exact installer error. Do not uninstall the original app prematurely.

### v0.9 authentic published cover art

The reference paper illustrations were concept mockups, not approved album art.
The Android receiver now bundles **the exact 2 published website album covers**
as offline `drawable-nodpi` JPEG resources (copied by Git blob identity from
`/cover.jpg` and `/releases/everywhere-near-you/cover.jpg`). They appear
in the album shelf, featured record and now-playing display, including while
the radio stream plays either release. Unknown/field-cart/release-incomplete
tracks use the neutral HUMKIN receiver icon, **not** a fabricated cover.
Warmth/Singles, which do not yet have verified public album manifests, likewise
show the station icon instead of unapproved mock art. The mockup skyline and
underline illustrations are no longer used.

No network download is needed for these images; Media3 metadata still points
to the same correct website cover URL for supported releases, preserving
lock-screen cover compatibility. As more albums are formally published, add
their authentic JPEG and register it in `AlbumArtwork`. Cloud-specific unique
artwork not bundled in this build uses the neutral icon until its approved asset
is added. No invented release art or icon-as-cover claims.

### v0.8 radio interactions
- Tapping **SAME-TIME RADIO** (including when already selected) now tunes
  and plays. If the native Media3 controller is not ready yet, the tap's
  intent is saved until the controller connects; repeated taps on an already
  playing dial do not restart the current record. The ROAD SHUFFLE mode button
  follows the same behavior. Paused Same-Time mode retunes to the clock.
- The small **waveform beneath Now Playing animates** while music is actually
  playing; it stops on pause, buffering, screen switch, leaving the Activity,
  or Android's reduced-motion setting. Album waveform animates only when the
  album is the active source. These bars are *procedural animation*, not an
  audio-reactive FFT: no microphone, media capture, or new permissions.

### New listener affordances
- **Coming up on the dial:** the actual next queued Media3 record; Same-Time
  labels this an approximation, not a claimed synced 24/7 transmitter.
- **Just heard here:** last three completed/transited records, read from a
  private, device-only recent-history list. Lock-screen transitions are
  recorded by the playback service; no listener log is uploaded.
- **Road Shuffle freshness:** local last-hour play times move recently heard
  songs to the back of each newly shuffled lineup, while preserving the
  randomness of never/recently-unheard songs. Release eras stay mixed. When
  the available catalogue is exhausted, older plays come back first; this
  cannot promise zero repeats in a small or incomplete catalogue.
- **Share the dial:** invokes Android's native share sheet, linking to
  the public station (no tracking/deep link).
- **Request line:** opens the existing verified-status station switchboard
  page. It does **not** falsely claim the line is accepting requests or
  automatically broadcast messages. No new permissions or backend.

The radio and its music service still take priority over social features.


The native Radio screen now borrows the published HUMKIN site's dark-ink
masthead, yellow station ticker, warm cream dial, high-contrast buttons and
pink accents. Published albums display their **real site covers**, bundled
offline. No concept mockup illustrations are used.

**Radio-only analog signal:** an opt-out, softly filtered local PCM hiss is
synthesized by the Media3 playback service after the user taps Tune In. Its
37.8% website-style texture is reduced by 4.2%; it runs only while Same-Time
Radio is actually playing and ready, including with the screen locked. It
pauses for buffering, audio interruptions and pauses, and is disabled outright
for Road Shuffle and albums. **Fractal signal weather** now varies the time,
depth and length of rare, gentle reception dips: a seed-dependent golden-ratio
walk through Mandelbrot escape times. Dips are 8–22% of player-session gain,
last 280–640ms, recur with ~10–34 seconds between events, and have a smooth
attack/release; the separate hiss gently narrows to mono during a dip.
The same static toggle controls both. Pauses, loss of audio focus, buffering,
clearing Same-Time Radio or turning the toggle OFF cancel pending dips and
restore the clean session gain. No device master-volume changes or music-file
processing. Fractals are a scheduling texture, **not real signal strength**. The ON/OFF setting persists per device. Static
never replaces or processes a music stream, and adds no network calls,
accounts or permissions. The browser's occasional crackle/pop effect remains website-only.


The Radio and Albums screens use the published website's authentic album art,
not the old visual mockup images. The text and controls remain
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
Run `gradle -p apps/android :app:assembleDebug :app:assembleFieldTest :app:testDebugUnitTest :app:testFieldTestUnitTest`.
On device verify:
1. Install the **Real Art** APK alongside the original, v0.7 Field Test or
   v0.8 Receiver if debug signatures differ.
   Confirm separate app icon/label and verify it does not erase the old app.
   Check first-tap SAME-TIME RADIO auto-plays even if the media controller
   was still connecting; tapping again while already playing must not jump.
   Test play/pause wave movement in both Radio and Albums; no hidden animation.
   Verify MUTANT POP and everywhere;near you show **the exact site covers**
   in the shelf, now-playing panel, and featured album; other station-only
   material shows the neutral receiver emblem, never paper mockups.
2. The cream/ink/yellow UI scales at 320–420dp and scrolls with readable labels.
3. Tune both radio modes, then visit ALBUMS and return without losing playback.
   Next Record is available in Road Shuffle. Catch Up to Air follows Same-Time Radio.
4. PLAY either album; test sequential playing on the locked screen and
   the next-track control; test switching back to radio.
5. Verify fallbacks on slow/no network, theme colors and cover loading.
6. Confirm the three-song station ID cadence still comes from backend config.
7. Toggle STATIC + SIGNAL DIPS on Same-Time; check quiet hiss and subtle,
   irregular level fades with static briefly narrowing toward mono. Verify
   phone pause, lock screen, audio focus interruption, buffering, mode changes,
   and **no hiss or dips** in Road Shuffle or album PLAY. Persist preference
   across app restarts.
8. Verify reshuffling Road Shuffle prefers records unheard in the last hour
   while still mingling older and newer material; the browser stream's
   fair-cycle implementation remains a separate code path.
9. Verify on-deck is the actual next queue entry, recent records update
   after transitions (including during lock screen), and Share uses a native
   chooser. Open Request Line and confirm it reports switchboard status
   honestly; sending a note does not publish it.

This is an unsigned-for-store debug build; Google Play developer enrollment,
physical receiver tests, and production signing are still pending.
