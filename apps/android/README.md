# HUMKIN RADIO · Android native receiver (prototype)

**Status: source prototype, NOT tested on a physical device or published to Google Play.**

A real Android app, not a WebView wrapper: AndroidX Media3 / ExoPlayer
with MediaSessionService provides native audio playback and Android lock-screen
media controls. It reads the same public static playlist and published Supabase
crate as the existing browser radio. Publishing music to the existing Crate
Loader makes that recording eligible on the next native Tune In / Reshuffle.

## Scope and honest limitations

- V0.1 runs **native Road Shuffle**, not the shared browser clock. The
  SAME-TIME button explicitly opens the existing web dial. No 24/7 hosted
  transmitter or broadcast license is implied.
- Native MediaSessionService keeps playback running while screen is locked,
  subject to network, battery management and Android's service policies.
  Device QA is required before asserting reliable background operation.
- Reads only public content with the same **publishable / RLS-restricted** key
  already embedded in the public FM page. Never commit service-role secrets.
- No login, tracking SDK, advertising SDK, contacts, location or microphone.
  Streaming consumes data. Files are not saved for offline playback.
- Bumper cadence comes from live public settings. When that read fails, the
  app does not claim or insert a synthetic cadence.
- At the end of a catalog cycle the player repeats that cycle's order. Full
  reseeding/automatic periodic reload, schedules, artwork curation, Android
  Auto integration, and in-app Same-Time mode are future work.
- The browser station and its public sites are untouched.

## Build from repo

Requires JDK 17, Android SDK platform 36, Gradle 8.13, internet access.

```sh
cd apps/android
gradle :app:assembleDebug
```

Install the resulting `app/build/outputs/apk/debug/app-debug.apk` on a device
for testing. CI uploads a debug APK artifact when the `Android radio prototype`
workflow runs; this is **not a Google Play release**. It is unsigned for Play
distribution; do not put signing credentials into source control.

## Pre-release acceptance tests

1. Start radio on phone; verify music and the native media notification.
2. Lock screen for **three full tracks**; verify complete transitions, then
   exercise pause/next from Bluetooth and lock screen.
3. Exercise loss/recovery of data and headphone unplug (pause), audio focus.
4. Test current Android 16 target behavior and Android 11 compatibility.
5. Confirm live crate additions and enabled bumpers appear on a fresh tune-in.
6. Confirm no private staging tracks play and no static sound is baked in.
7. Add proper adaptive launcher icon, screenshots, content-rating, data-safety
   declarations, privacy/support pages, signed AAB, on-device review.
8. Complete Google Play developer verification and closed testing requirements
   if applicable. The owner controls enrollment, signing key and publishing.

Native build tooling is isolated in `apps/android`, with no changes to the
GitHub Pages site. To stop this experiment, close the PR and delete the branch.

## Naming

Prototype package ID: `org.abundent.humkinradio`. Confirm final package name
before any Play Console creation; Play package IDs are permanent once published.
