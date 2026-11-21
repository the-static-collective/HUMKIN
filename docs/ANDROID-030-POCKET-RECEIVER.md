# ANDROID-030 — Living Pocket Receiver / Android 11 wallet fix

## Root cause (reproduced from user's actual crash report)

Android 11's `java.io.InputStream` does not implement `readNBytes(int)`. The native HUM wallet's network response parser invoked it at `HumServerBridge.post:79`. This raises `NoSuchMethodError`, a `LinkageError` and **not** an Exception; therefore the existing asynchronous catch(Exception) did not intercept it. Launching in safe mode could still crash as soon as a media service or other wallet path used the same call. This is a confirmed code-level bug, not a speculative networking failure.

Fixed by `ApiCompatStreams.readAtMost(in,12000)`, using `InputStream.read(byte[],int,int)` available since Android 1.0, returning a bounded byte array and closing streams in the caller. Unit tests cover EOF, exact maximum, zero max and unusual zero-length reads. CI grep bans reintroduction of unsupported readNBytes/readAllBytes/transferTo calls.

## Appearance: actually target the approved picture

The earlier ANDROID-028 APK still showed the old stacked native page. `radioPocket` is a new side-by-side Android app with an image-faithful **new face**. The reference image is now permanently bundled in the repo as `drawable-nodpi/living_receiver_face.png`; not fetched at runtime.

`LivingReceiverFace` overlays separate actual hardware controls on the illustrated chassis:
- Animated/rotating physically cut-out brass tuning and volume wheels.
- Frequency dial changes virtual 88–108 positions (98.2 is the sole real HUMKIN channel); unknown channels pause audio and open the Station Guilds workshop message.
- AM archive band, mono, and boost are explicitly unfinished.
- Same-Time, Road Shuffle and Tune In call the same native Media3 engine; title, artist and bundled album covers are live media state, not the fake words in the reference.
- Album shelf, Signal Outpost, Radio controls reachable from the mockup's four bottom navigation buttons.
- Playing state illuminates lamps and animates waveform bars.
- The user-supplied mockup has not become a fake second playback engine. The picture is **visual material**, not the application's logic.

The radio-page replacement is deliberately scoped to `org.abundent.humkinradio.pocket` (`HUMKIN · POCKET RECEIVER`), leaving the user's existing `.living`, `.rebel`, `.nightwatch`, and other local progress untouched. The `MainActivity` constructs the original radio model internally to keep song rotation, track metadata, albums, reporting and game state on the existing playback engine, but the old radio UI is hidden for Pocket. It will be refactored to explicit state bindings once the prototype proves stable.

## QA requirements

- Android Actions: `:app:assembleRadioPocket` and `:app:testRadioPocketUnitTest`, plus existing variants.
- Manual Android 11 phone: open without crash, 98.2 play/pause, media notification and background playback, knob and band switches, actual album cover, name changes, mode transitions, view scaling, and orientation.
- CI Gradle cannot establish live Android launch stability; emulator test is welcome but Android virtual device installer previously failed with an infrastructure Broken pipe before launching.
- Thumb-source art is bundled via Canva intermediary; a future image-pipeline pass can replace it with the 864x1536 original source to maximize texture fidelity without touching wiring.

The previous HUMKIN web UI remains restored on `main`. This change is **native Android only**.
