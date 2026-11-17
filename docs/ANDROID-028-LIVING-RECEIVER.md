# ANDROID-028 · The Living Pocket Receiver

Android source branch: `feat/native-android-radio-001`.
Design target: user-approved HUMKIN enamel/brass pirate radio visual snapshot.
Separate install: `org.abundent.humkinradio.living` / `HUMKIN · LIVING RECEIVER`.

## Shipped in this Android iteration

- The previously illustrated native `RebelReceiverSkin.Dial` is now a **real virtual-channel control**. Finger/trackpad touches and movement on the scale or brass wheel adjust the display needle and knob, with haptic click and accessible frequency description; D-pad left/right steps the channel by 0.2.
- `98.2` in-app FM currently represents the existing real HUMKIN Media3 radio. Leaving the valid dial region pauses playback. Tune In refuses an unbuilt channel rather than secretly playing unrelated audio.
- The illustrated **AM switch** actually changes band state and opens a 'Loose Wire' workshop dialog. The smaller native volume knob rotates with finger movement and adjusts the existing Media3 player's audio gain, storing its setting locally. AM, MONO, BOOST and the ornamental signal meter never pretend to provide capabilities or archive streams that are not yet built.
- The workshop dialog links to the existing native Station Guilds. This is a participation doorway, **not** a claim that a station-build backend or live station manager exists.
- Existing Same-Time, Road Shuffle, artwork, radio waveform, HUM and Orchard/Outpost behavior remain on the established Android native engine; tuning no longer doubles as a playback-mode shortcut.
- Dedicated `radioLiving` debug build type ships as `humkin-radio-android-living-028` Actions artifact, preventing accidental replacement of `.rebel` and older experimental packages/local records. Debug signing remains ephemeral.

## What is still prospective

- A signed station registry with owned virtual frequencies, owner eligibility, HUG/rights/moderation proof and channel life cycle.
- AM archive recordings and actual public-performance/rebroadcast clearances.
- Native DSP for MONO/STEREO and BOOST (the working volume control requires no such DSP).
- Full screenshot-level fidelity to the supplied artwork (weathering, ornamentation, textures); current skin is a functional drawn native reconstruction.
- End-to-end Android 11 device test: finger drag, landscape, font scaling, focus, audio pause, screen-off Media3, workshop navigation.

This isn't an RF radio. Virtual FM is a metaphor for station selection, not allocation of a physical frequency.

## Verify

On GitHub Actions `Android radio prototype`, verify `:app:assembleRadioLiving` and `:app:testRadioLivingUnitTest` pass along with existing native variants. Download the artifact and install on Android 11 or later. Compare visual control geometry and latency against the reference and log any clipping.
