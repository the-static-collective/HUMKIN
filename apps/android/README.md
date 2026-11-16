# HUMKIN RADIO Android · v0.12

## Listener-first receiver / install recovery

**Install this build as `HUMKIN RADIO · SONG LOG`**, a separate Android
package `org.abundent.humkinradio.songlog`. This is a **new test identity**
so Android can install it beside v0.7 Field Test, v0.8 Receiver, and v0.9 Real Art, whose
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

### v0.12 · Compact Coming Up / Just Played

Listener requested the useful playback log from the original v0.9 screen
returned, without the long explanatory blocks marked out in the annotated
screenshot. Just below the main Pause/Tune In button, a compact outlined
two-part card now shows **COMING UP** (actual next Media3 queue item,
one truncated title) and **JUST PLAYED** (two latest previously played
titles, at most two lines). It updates on player transitions, using the
existing private on-device song history. This is not a new server or
synthetic program schedule. Explanatory suffixes such as "approximate
Same-Time rotation" and "your Road Shuffle queue", the large history card,
static explanations and duplicate album shortcuts stay removed. More ⋯
retains the specialist reception controls; the on-screen history is no
longer redundantly listed in that menu.

As with previous test packages, this .songlog build has separate app data
and cannot import local listening history from the older temporary apps.
The queue will naturally populate after playback begins; no data is shared
or uploaded.

### v0.11 · No resetty radio

Listener reports hearing the same few songs around restarts. Investigation
found three separate effects:
1. The published Same-Time dial is a **client-side shared-clock playlist**,
   not a continuously broadcasting server. A new cold tune selects the song
   airing at the *same station time*. Listening again a few minutes later
   may correctly yield the same song, and retuning can repeat a short stretch.
2. Until v0.11 the native Pause → Tune In and same-mode taps could fetch a
   new station queue, even though the Media3 service still held a perfectly
   good paused or playing queue. Resume now keeps that queue and position
   when paused less than 5 minutes. Longer pauses in Same-Time retune to
   the official current air clock. Catch Up to Air remains in the ⋯ menu.
3. The old shuffle rebuilt a new randomized queue when Android killed the
   player process. Its recent-history list only remembered tracks that had
   transitioned, so the *interrupted current track* could also reappear.

New private, device-local `PlaybackContinuity` snapshots active track ID,
playhead, mode and up to 120 remaining approved queue IDs every 12 seconds
while playing and on media transitions / pause / service shutdown.
After process death, a new Road Shuffle tune within 45 minutes resumes that
record from the saved position and plays the saved remaining sequence. It
then appends a fresh full rotation so an interrupted last track cannot loop.
While Road Shuffle is playing (including overnight with the screen locked),
the native Media3 service also appends a newly mixed, last-hour-aware
rotation **before** its queue gets short. It no longer wraps forever to the
same first-to-last arrangement after one complete playlist.
All saved IDs are re-resolved through the published catalog; no arbitrary
saved URLs are played. Older/invalid bookmarks instead start a fresh queue
using recent play history, now including the *currently active* track.
The user-selected last mode is remembered; no new sign-in, sensitive
permission, analytics or server.

**Same-Time is intentionally different**: on a new process it still joins
the shared clock rather than secretly selecting a personal anti-repeat song.
If the user wants nonrepeating private listening, Road Shuffle is the right
mode. The browser implementation remains separate; this is an Android change.

**Important:** This fresh `.continuity` sideload has a separate Android app
identity because prior CI runs used temporary keys. Device-private playback
history **cannot migrate** across those test app identities; the new continuity
starts building memory from its first play. In-place updates still need stable
production signing.

### v0.10 · The simple dial

The listener marked the **ancillary** regions of the v0.9 radio screen for
removal in a phone screenshot. Primary radio now shows just:
- HUMKIN header / station identity, Same-Time and Road Shuffle (both tune/play)
- canonical album artwork, track title and moving waveform
- prominent Play/Pause
- ALBUMS and the two unmarked listener actions, Share / Request Line

Removed from this screen: explanatory mode panel, permanent static-settings
button and air-weather footnote, Next/Catch-up/Reshuffle toolbar, large
Coming-Up/Just-Heard history card, technical success text, repeated album
shortcut row, request-line disclaimer, and station archive/privacy footer.
The small **⋯** control beside THE HUMKIN DIAL preserves access to static/
signal dips toggle, Catch Up / Next / Reshuffle (depending on radio mode),
Coming Up and last three recently heard, station archive and privacy.
The album shelf retains its own navigation and controls; audio service,
radio scheduling, volume, playlist history and website remain unchanged.

No new permissions, backend, tracking, or network work. This v0.10 sideload
uses a fresh test package because prior CI build signatures are ephemeral;
we still need stable protected production signing for in-place upgrades.

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
