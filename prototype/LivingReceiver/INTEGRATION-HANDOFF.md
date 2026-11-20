# HUMKIN Living Receiver — Integration Train 1, step A

Date: 2026-11-20. Input: Work's `LivingReceiver-source.zip` (v0.1.0), not the existing HUMKIN Java Android branch.

## Completed in this source bundle

- Removed `ReceiverActivity`-owned player. Created `ReceiverPlaybackService` with Media3 `MediaSessionService`, HLS-capable ExoPlayer and Android `mediaPlayback` foreground-service permissions.
- Added asynchronous `MediaController`, Resume button, service-owned cue parsing and listening metering. Locking/backing out of the Activity no longer explicitly stops the audio.
- Fixed qualified local demo HUM to require an uninterrupted session on a single station: interruptions, station changes, pauses/stalls, seeks, clock gaps, and playback item changes reset progress. Added unit tests and compiled/ran local Kotlin assertions (10 passed).
- Relaxed HLS DATERANGE attribute order and allowed art from the known HUMKIN R2 host; improved in-app claims to distinguish local demo states from the actual networked HUM/Orchard.
- Kept side-by-side app ID, all existing website/Java Android branch histories untouched. This package does **not** include a rebuilt APK; the original uploaded v0.1.0 APK is unchanged.

## Remaining before a trustworthy receiver

1. Run Android SDK 35/Gradle 8.13 CI compile and JUnit tests from this source (workflow included).
2. Test Android 11 background/lock screen, headset media buttons, foreground playback notification and crash/restore behavior on a real phone.
3. Replace the two hard-coded HLS station URLs with the authoritative live Tower station registry, verify actual HLS cue grammar and media metadata.
4. Integrate truthful HLS→Long Wave→Same-Time fallback with one-playing-player guarantee and an explicit signal status.
5. Connect verified server HUM, full catalogue records, authorized file downloads, and existing Orchard. The one-record file URL/checksum is **not independently checked**.
6. Decide stable release signing and upgrade/migration before distribution beyond side-by-side field trials.

## Safely stage as a draft GitHub PR

- Put this archive's `LivingReceiver/` contents under `prototype/LivingReceiver/` in `the-static-collective/HUMKIN` on a new `review/living-receiver-service-*` branch, not on main.
- Put the included `living-receiver-debug-apk.yml` in `.github/workflows/` and push the branch.
- CI compiles/test/uploads `app-debug.apk` under a distinctive engineering-preview artifact name. Do not merge until its tests and Android 11 acceptance pass.

No deployment, Play Store publishing, remote data writes, or server migrations were performed.
