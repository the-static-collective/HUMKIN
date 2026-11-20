# HUMKIN Living Receiver — service-backed engineering preview (0.2.0-test)

This is an **isolated prototype**, not the installed HUMKIN Radio replacement or a production migration. App ID `org.abundent.receiver` (Android 8+). The interface is Compose; audio is owned by a foreground-capable Media3 `MediaSessionService` and exposed via `MediaController`. The service persists after `ReceiverActivity` stops or is recreated while playback is ongoing. There are lock-screen/notification playback controls from the session.

## Build

With JDK 17, SDK 35 and Gradle 8.13: `gradle :app:testDebugUnitTest :app:assembleDebug`. A GitHub Actions build-only workflow is included separately when staged in the HUMKIN repository.

## What changed versus 0.1.0

- Moved ExoPlayer, HLS manifest cues and the listening meter out of `ReceiverActivity` into `ReceiverPlaybackService`, with `MediaSession` and Android's `mediaPlayback` foreground-service permissions. Do not pause when the Activity stops.
- `MediaController` is connected asynchronously. Playback now survives UI navigation/lock-screen in architecture (phone validation is required). The receiver offers both Pause and Resume.
- Listening is counted only inside one uninterrupted station session with advancing playhead. Pauses, stalls, discontinuities, seeks, clock gaps, and station switches reset it. The service rather than the screen accounts for progress.
- Cue parser handles attribute reordering/additions. Artwork accepts only HTTPS from the known HUMKIN/R2/relay hosts.
- Upgraded to `0.2.0-test`. No user files/previous packages are modified by building.

## Crucial exclusions

- The two hard-coded stations and their HLS endpoints have NOT yet been verified against the live Tower registry. No automatic HLS→Long Wave→Same-Time fallback is implemented.
- `earned`, `hum_receipt`, Orchard, and discovery are **local demo state**, not canonical HUMKIN signed server currency, not the networked Orchard.
- One sample recording `mutant-pop-04` is hardcoded, including an **unverified external SHA-256**. Offline downloads are app-private, not user's Music collection.
- Android screen-off and lock-screen controls, actual HLS playback/cue format, verified download, real device restoration, update signature and Android 11 reliability still require hands-on field tests.
- Do not merge an entire old Android branch into the current website; import on a narrow isolated PR. Stable signing/migration plan required before promising in-place APK updates.

## Android 11 field test

1. Install side by side, launch, tune Station One and confirm actual audio.
2. Lock screen for three song changes and verify audio and media notification controls.
3. Background and reopen the app: confirm station and progress survived without retuning.
4. Pause and resume, switch to Talk, and interrupt the network; confirm demo HUM does **not** combine disjoint listening.
5. Check title/artwork is aligned with the audio actually heard.
6. Only attempt the offline record after verifying the remote MP3/hash independently, then test airplane-mode playback.

Do not claim any of those tests passed from a green CI build alone.
