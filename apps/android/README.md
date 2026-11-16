# HUMKIN RADIO · Android native receiver

**Version 0.2 source prototype, CI build required, not Google Play published.**

The native receiver uses AndroidX Media3/ExoPlayer MediaSessionService, enabling
audio to continue when its Activity disappears on screen lock.

## Two native listening modes

1. **Same-Time Radio (new):** Java port of the browser's `seededShuffle`,
   cycle-duration calculation and every-N station ID insertion. It reads
   static `fm/rotation.json`, the nine owner-approved `fm/air-carts.json`
   items, public static metadata overrides, cloud published/approved tracks,
   public bumper settings and the station clock RPC. When you tune in it seeks
   once to the shared nominal song and position. Subsequent songs play in full,
   and MediaSessionService extends deterministic cycles even screen-off.
2. **Road Shuffle:** native personal shuffle + approved bumpers; next button.

Both avoid WebView playback, ads and analytics.

## Important radio boundaries

- **Same-Time** is a client-side approximate sync, not an Icecast transmitter.
  Media buffering, Android clock drift and reconnections may move receivers
  out of phase. Explicit **CATCH UP TO AIR** retunes to the nominal time.
- **The native V0.2 clock implements the ordinary seeded rotation only.**
  Currently no active scheduled program is stored in the station DB. If
  special scheduled shows are later enabled, the web dial may differ.
- Browser-only analogue static texture (37.8% setting) is **not yet** present
  natively. No baked hiss on Road Shuffle or source MP3s.
- The public cloud catalog must be reachable to achieve clock parity. If any
  source fails, the receiver labels itself *approximate*, not perfectly synced.
- The service's rolling station plan lives inside the app process; if Android
  kills the service process, use Tune In again.
- New approved songs join when the user retunes. Currently playing songs
  complete; the app does not interrupt one for real-time catalog updates.
- Supabase publishable key uses existing public RLS-only endpoints; not service
  role credentials. No tracking, login, location, microphone or offline cache.

## Build & verification

Requires JDK 17 / Android SDK 36 / Gradle 8.13.

```sh
cd apps/android
gradle :app:assembleDebug :app:testDebugUnitTest
```

Debug APK is attached to CI. Device test required, preferably Android 11 and
Android 16: tune-in Same-Time vs website during same minute; listen through
three song boundaries with screen locked; make an incoming call and verify
audio focus; press Catch Up; test Road Shuffle and Bluetooth headset controls.
This code is not a Play Store release; owner enrollment and signed AAB are
still required.

Package ID `org.abundent.humkinradio`; confirm before store registration.
