# HUMKIN RADIO Android · v0.22 Field Test — THE UNFOLDING OUTPOST

**Install name:** HUMKIN · OUTPOST 022  
**Independent test package:** `org.abundent.humkinradio.discovery`  
**Artifact:** `humkin-radio-android-field-test` → `app-fieldTest.apk`

This release deliberately returns to **a simple first encounter**: tune in,
play albums, mark what a song meant to you, and visit the **Signal Outpost**.
There is no longer a full-size Bootleg Frequency or Orchard button on the main
radio. The world/Top 42/Guilds shortcut is tucked into the radio's ⋯ menu;
record league and Guilds remain available through the Outpost.

The earlier three-song browser sketchbook is deliberately not linked in the
radio overflow: it must not become a shortcut around the Level 7 personal
station reveal. Its implementation remains in the repo, not active on the
new first-run radio face.

The Outpost now owns two **earned, persistently unlocked listening worlds**:

- **Level 4 — THE LISTENING ORCHARD.** Its first gateway is initially
  presented as a sealed green room. At level 4 it reveals the real native
  Orchard, with collectibles, furnishing and garden stages. The existing
  Orchard's own item levels/workbench requirements still apply.
- **Level 7 — BOOTLEG FREQUENCY.** Not revealed by name until the Orchard
  opens. Level 7 gives the listener the full native, emotion-shaped pirate
  radio dial powered by private song responses and opted-in public Listener
  Weather.

These levels already correspond to the existing RPG's first Backroom and
Long-Range sectors, so no new currency or arbitrary checklist was created.
The XP thresholds are `SignalMath.levelFloor(4)` and `levelFloor(7)`;
experience comes only from actually audible native Media3 audio, never
silence, the wall clock, spending or station-view visits. Existing Outpost
progress within **the same package and signing identity** is honored. The
discovery board visibly reports XP remaining before the next door.
The two activity entrypoints also check the Outpost level so hiding a radio
button isn't mistaken for a functioning gate.

The workshop itself now **reveals only the next tier** in each department,
instead of showing nine locked/projected abilities to a newcomer. This avoids
spoiling the later station and preserves progression. The native radio,
qualified Top 42 listening, previously approved carts, explicit permission
for anonymous emotion sharing and all current Outpost economics are unchanged.

**Field-test caveat:** `.discovery` is separate from previous
`.frequency` and `.weather` packages. Because current CI Android debug
signing is not stable, old listening XP/Orchard HUM/private reactions do not
automatically migrate. Keep previous apps installed; a stable release key and
explicit migration/export workflow remain prerequisites for safe upgrades.
Physical Android 11 field testing remains to be done.

**Acceptance:** Fresh install must show one main Outpost entrance, no
Orchard or Bootleg button on radio; in Outpost only first-tier workshop doors
are visible. With XP below `levelFloor(4)`, neither activity may open
even via internal Intents. At level 4, Orchard reveals, personal frequency
remains sealed; at level 7 both open. Changing radio modes must not alter
the level; leaving an Orchard/Frequency screen must return to Outpost.
Listening in the background earns levels; opening screens alone does not.
Confirm older unlocked profiles in the *same app install* retain doors.

---

# HUMKIN RADIO Android · v0.21 Field Test — BOOTLEG FREQUENCY

**Install name:** HUMKIN · BOOTLEG FM  
**Independent test package:** `org.abundent.humkinradio.frequency`  
**GitHub Actions:** `humkin-radio-android-field-test` → `app-fieldTest.apk`.

The main receiver's **BOOTLEG FREQUENCY** button opens a fully **native**
listener-run radio dial, not the prior embedded web sketchbook. It shares the
real Media3 background audio receiver and plays only owner-published tracks.
There are three painless decisions: desired human feeling (open, hope, tears,
less alone, laughter, movement, stays-with-me), whose ears to consider
(my local reactions / both / anonymous community), and optionally the first
song (currently playing or one previously personally reacted to).
The user can preview and reshuffle before explicitly starting playback.
It keeps adding real, new, mixed-era selections while the phone is locked,
and incorporates existing owner-approved bumpers only if the public station
has a nonzero bumper cadence. It does **not** emit RF or set up actual
broadcasting equipment.

**Signal math:** Released singles and albums get roughly 2× their normal
sample probability. Local answers favor the corresponding feeling, while
voluntary public **Listener Weather** aggregates provide gently smoothed
crowd support without making any song compulsory. Unreported songs always
remain eligible. Current or recently heard songs are pushed later; an
explicitly anchored song still starts first. If the community board is
empty or offline, the interface says so and uses private/local-first choices.
The public web Listener Weather form at `/fm/top42/#listener-weather`
accepts anonymous human reactions from anyone—not only Android users.
The private listening diary stays on the individual phone unless the
listener explicitly opts in to share answers.

**Accounting boundary:** The official Top 42 still counts only real
qualified audible listens and never the emotional answers themselves.
Local Outpost/HUM uses only audible Media3 playback as before. The main
Same-Time radio and the 93/7 scheduled chart-programming split are unchanged.
The old three-song web sketchbook remains under the radio overflow menu
but is no longer the primary station-building path.

**Field-testing boundary:** The `.frequency` build is a new side-by-side
debug package because current GitHub CI builds use ephemeral signing keys.
This means private reactions and Outpost progress in the previous `.weather`
or `.station` installs **do not transfer automatically**. Do not uninstall
previous builds until we have a stable, securely stored signing key and a
proper migration path. CI and JVM unit tests are necessary but do not replace
physical Android 11 audio-focus and lock-screen tests.

Device acceptance: choose a mood, anchor a rated song, preview, start the
native station; confirm lock-screen play, native waveform, Next Up and history;
confirm approved bumpers appear at configured intervals, no analog hiss in
personal mode, and Same-Time/Shuffle still switch cleanly. React on phone,
optionally share, check real Listener Weather aggregates on the public site,
then change the feeling and verify it replaces the earlier submission rather
than incrementing chart plays. Check airplane-mode fallback and that the phone
can still tune public radio normally after leaving the personal dial.

---

# HUMKIN RADIO Android · v0.18 Field Test — Live Network Crossing

**Install name:** HUMKIN RADIO · NETWORK
**Independent APK package:** org.abundent.humkinradio.network
**Build artifact:** humkin-radio-android-field-test / app-fieldTest.apk

Native radio / Signal Outpost / Orchard / Guilds are preserved. The native Orchard now links to the *real* web-hosted listener network and Trading Post, with a separate voluntary **CARRY MY NATIVE SCENE** option. The latter asks permission and opens a browser URL preview of only the decorative stage, locally owned object type IDs and aggregate minutes. The URL may appear in browser or server logs. The browser strips the query from address bar once loaded. Nothing publishes until explicit PUBLIC opt-in and SAVE; no native HUM or artifacts transfer into the canonical network.

The live browser network offers opt-in signed HOME snapshots, live foreground snapshot requests, server-issued collectibles, atomic two-party gift transfers and voluntary catalog work. This does NOT turn the native Android app into a persistent background GHoT worker or replace the Media3 radio process. Native and browser signing identities and economies remain distinct. The .network suffix is side-by-side with earlier field-test identities and is not an in-place update because production signing remains unresolved.

Physical Android validation is still needed. Do not uninstall prior APKs.

---

# HUMKIN RADIO Android v0.17 · REAL STATION GUILDS (FIELD TEST)

- **Install label:** HUMKIN RADIO · GUILDS
- **Test applicationId:** `org.abundent.humkinradio.guilds`
- **Feature:** First-class `STATION GUILDS` link from the native radio and Signal Outpost, opening contained first-party `/fm/participate/` (not a second audio player).
- **Phone video/audio intake:** Android WebView uses native document picker via `WebChromeClient.onShowFileChooser` and `startActivityForResult` (Android 8+). User can choose existing recorded media without sharing arbitrary filesystem access. The web desk obtains a short-lived signed upload token for a single private Storage object; review is owner-only.
- **Street Team:** Manual social posting, public proof link, optional handle, clear material-connection disclosure, human verification. No social passwords/OAuth scraping or autoposting.
- **HUM:** Local Orchard shopping HUM is still separate from the new server-reviewed, nontransferable verified contribution HUM. No automatic credits for an upload or hardware claim.
- **Native radio:** Media3 background service, controls, Top 42 and existing Outpost are unchanged.
- **Privacy:** Contribution passes belong to the contained WebView install's private storage. Back up the participation pass from the Guild page to recover receipts if uninstalling this field-test APK.
- **Status:** CI debug/field-test APK is a test build. Physical-phone video picker, large-file transfer, and background playback still require hands-on QA. Native v0.17 is not a production Play Store release. It installs alongside older test variants but does not import their local saves.

---

# HUMKIN RADIO Android · v0.16 Field Test — The Listening Orchard

**Install name:** HUMKIN RADIO · ORCHARD  
**Independent test package:** \`org.abundent.humkinradio.orchard\`  
**GitHub Actions artifact:** \`humkin-radio-android-field-test\` containing \`app-fieldTest.apk\`.

The **native** main receiver now has **YOUR LISTENING ORCHARD**, a separate playable illustrated room and evolving garden. It draws its own record player and trees, allows buying/placing/stowing thirty curiosities, and discovers eight strange local artifacts over actual Media3 listening time. Native HUM is a device-only in-game currency. The native radio's already measured, audible \`SignalRpg.totalMs\` is the *only* source of listening HUM; opening the scene or leaving the phone on without real playback yields no points. Existing Signal Outpost, Top 42, playlists, audio behavior, album art and field-test privacy boundaries stay separate.

There is an explicit **level-4 voluntary local catalog workbench**. One click reads only the public JSON radio manifest (max 100 KB), validates song entries, computes SHA-256 and records at most one local reward/day. No arbitrary remote task execution or background compute; battery below 25% while unplugged causes HOLD. Browser/PWA Orchard and native Android Orchard are two **separate local saves** and have different earned balances. Neither store implies globally scarce serial numbers, peer trades, monetary tokens or a signed GHoT network receipt.

App stores and account-backed trading require another implementation. This is a CI-built APK, *not* an update to older test package identities. Keep existing builds installed; a stable signing key remains prerequisite for in-place upgrades. Validate on a phone: true Media3 background play accrual, garden drawings, shop purchases, 4-minute artifact, manifest audit, and audio continuing while switching screens.

---

# HUMKIN RADIO Android · v0.15 Field Test — Outpost Ability Tree

**Install name:** HUMKIN RADIO · OUTPOST+  
**Test package:** `org.abundent.humkinradio.abilities`  
**Build artifact:** `humkin-radio-android-field-test` / `app-fieldTest.apk`

Every upgrade now opens **new participation mechanics**, not just increasing
Signal or XP generation. The three existing workshop departments unlock:

| Department | Tier I — LIVE | Tier II — LIVE | Tier IV — FUTURE |
|---|---|---|---|
| Antenna | Chart Radar: live standings and sleepers | Request Beacon: file one real daily public nomination | Community Frequencies |
| Tape Archive | Scout's Crate: local shortlist of 42 songs | Little Press: draft 4 radio-only + 2 released songs into a real editable EP | Record Trading Post |
| Night Crew | Field Challenges: share real three-song listening quests | Night Editor: share a fictional station bulletin grounded in actual chart/request counts | Cooperative Relay Stations |

"Future" doors are **preview-only**: no buttons that pretend an unfinished
server exists. All six live abilities are native Android screens. The Request
Beacon creates a real bounded nomination via the existing public Supabase
league API and displays on the live website's Request Desk. Requests are
separate from qualified chart listens, radio spins, votes or promises of
airtime; they cannot be purchased using local Signal. The Little Press only
prepopulates a valid EP in the public builder; release requires a separate
explicit tap.

The receiver's listening, albums, lock-screen controls, Top42 and existing
personal outpost economy are unchanged. Upgrade levels and watched tracks
are stored privately on the installed device with no account or analytics.
The test identity keeps earlier APKs installed side-by-side, but **cannot
import local RPG progress** from the v0.14 test package. A fixed signing
identity is needed for continuity and eventual public distribution.

This is field-test software: automated compilation / JVM tests are
prerequisites, physical phone validation is pending.

---

# HUMKIN RADIO Android · v0.14 Field Test — Signal Outpost

**Install name:** HUMKIN RADIO · OUTPOST  
**Test package:** `org.abundent.humkinradio.outpost`  
**Build artifact:** `humkin-radio-android-field-test` / `app-fieldTest.apk`

This version wraps the **native** Media3 receiver and the existing Top 42
record-league WebView in a small listening-based idle RPG. The new **SIGNAL
OUTPOST** button appears near the top of the radio screen. No existing
radio/shuffle/album interface has been replaced.

The core loop is: tune to actual radio → real audible Media3 playback fills
a **local capacitor** and earns experience → return to Outpost → collect
signal → upgrade antenna, tape archive or night crew → dispatch a field crew
on a listening mission → claim its reward → unlock new relay sectors.

- Signal and experience accrue **only during actual playback**, batched by
  the Media3 service. Locking the phone does not stop earning so long as the
  Android player really continues; closing the app or pausing the station
  produces no pretend offline rewards. Capacitor has a visible capacity.
- New recordings are *discovered* only after 30 seconds of playback and
  credited once per recording, regardless of repeated loops. The service
  remains the source of truth for audible time.
- Missions: eight-minute AM relay repair, four unique-song B-side retrieval,
  level-4 unlocked twenty-five-minute Long Night.
- Daily orders: listen four minutes, hear three different tracks, open Top 42;
  reset on the America/Chicago day boundary without punitive streaks.
- Procedural native tower-map sectors, rank/level bar, local trophy shelf,
  and responsive fictional **Night Desk** dispatch logs.
- Local Signal/XP are **not** public Top 42 points. Top 42 scoring still uses
  its own qualifying-play API. Gameplay does not create fake plays, airtime,
  votes, or influence the chart except through actual listening.
- Account-free and local-only: no sign-up, microphone, ad network, permission
  change, or cloud save for the RPG.

This remains a **field-test APK** until real-device navigation, typography,
background-play accrual, capacity, and audio interruptions are checked.
The `.outpost` sideload has **separate local history** from prior ephemeral
test-package variants. Do not uninstall another HUMKIN app just to install
this trial. Stable upgrades will need a protected production signing key.

---

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
