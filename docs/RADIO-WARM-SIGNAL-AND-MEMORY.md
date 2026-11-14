# HUMKIN RADIO · One-Hour Memory & Warm Signal

**Release:** November 14, 2026 · `/fm/` only. No music or station records were modified.

## One-hour memory in ROAD SHUFFLE

Road Shuffle now keeps a small playback history on each listener's device using `localStorage` (no tracking service or server required). When choosing the next song, it prefers recordings whose last playback started at least **60 minutes** earlier. The same recording ID is remembered even when the user refreshes the page.

- At cycle boundaries, newly shuffled songs heard during the last hour move to the end of the next cycle. A song in the next slot that was heard recently is swapped with an eligible later song instead.
- If the current cycle only contains recently heard songs but another previously played song is now over an hour old, the player starts a fresh cycle early rather than violate the one-hour policy.
- If **every enabled song** was played within 60 minutes (a small music library or someone rapidly hitting Next Song), a repeat is mathematically unavoidable. The player chooses the **least recently heard** remaining candidate instead of stalling.
- Bumpers/station IDs are intentionally exempt from the 60-minute music rule, because they're meant to repeat every few songs.
- Explicitly pressing **HEAR THE NEW ONE** is a listener-directed request and can replay that song. Scheduled Same-Time RADIO is **not** affected: it retains its shared clock and curated program lineup.
- The memory is device-local, not global across listeners or devices. Clearing browser storage resets it. Only track IDs and local timestamps are stored.
- The existing 21-song no-repeat tests, scheduled dayparts and bumper cadence tests still run in CI.

## THE OLD AIRWAVES — WARM SIGNAL

The radio now has an **OFF-by-default**, explicit **WARM SIGNAL** toggle beneath the audio player and a `RADIO PATINA` slider (0–100%; default 26%). Intensity is remembered locally but the toggle requires a fresh tap each session.

It layers three tiny analogue-inspired effects over normal playback:

1. A filtered, low-level stereo hiss made entirely in the browser using a looping Web Audio noise buffer, high-pass and low-pass filters and a smooth gain envelope.
2. Sparse, soft 7–20 ms crackle/pops generated with very short envelopes, at randomized intervals rather than a loud repeating loop.
3. Occasional signal dips: the noise bed briefly folds toward a mono-centered image while the unprocessed media element's existing `volume` is gently reduced about 7–20%, then restored. The full music signal **does not undergo true stereo-to-mono channel folding** in this first version.

**Why avoid actual music-channel routing right now?** Routing HTML audio through Web Audio's `MediaElementAudioSourceNode` can make cross-origin MP3s go silent when their CORS response isn't accessible. HUMKIN plays both same-origin GitHub Pages files and cross-origin Supabase public MP3s; the phone recently suffered playback interruption problems. This version deliberately **does not call `createMediaElementSource()` or switch MP3 sources** to add radio effects. Your original music stream, metadata, source switching and lock-screen playback are unchanged.

Safety and resource boundaries:

- No effects start without user gesture. Turning the layer off stops its timers and restores the listener's original audio volume. Pause also mutes the noise bed.
- In browsers without AudioContext, the toggle says the layer is unavailable and music continues normally.
- Noise lives entirely on the listening device; none is uploaded, encoded, embedded in originals or sent to a broadcast server.
- Some mobile browsers lock down `HTMLMediaElement.volume`, so the occasional gentle attenuation might not work on those devices; static and pops will still be possible.
- Background tabs can suspend effect timers/AudioContext and native music playback. Audio effects are **best-effort decoration**, not a workaround for Android browser audio lifecycle limitations.
- The native downloadable M3U/VLC path bypasses this website audio layer; the optional ambience exists only inside the HUMKIN player.
- Real mono/stereo music folding and noise synchronized to the remote broadcast source could be implemented later with carefully verified audio origins or directly in the Icecast broadcast engine.

## Test plan

GitHub CI runs `tests/radio-warm-signal.test.mjs`, `tests/radio.test.mjs` and the existing manager/program/recording checks. The tests validate persistent history, available-song selection, least-recent fallback, signal sound engine graph lifecycle, soft level dips, restoring the listener's volume and non-destructive routing.

**Phone field test:** Select ROAD SHUFFLE; skip several songs and verify they do not return soon after a cycle boundary. Toggle WARM SIGNAL ON while a song is playing and adjust RADIO PATINA from 15% to 60%; listen for subtle warmth, soft pops and occasional brief fading. Disable the effect and confirm the original volume returns. On an old Android device, start with a low intensity and modest speaker volume.

**Production status:** This is browser audio processing tested through synthetic JavaScript mocks and CI, not a claim that a real phone has been acoustically tested.
