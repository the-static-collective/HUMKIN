# ANDROID TOWER HLS — first optional native integration

## Behavior

The recovered classic app gets a clearly labeled **Live Tower · Experimental**
button. It uses Android's existing foreground Media3 playback service,
with `media3-exoplayer-hls` to load the exact current public Tower Station
One manifest (same URL as `fm/live-station.js`).

This is an opt-in **third choice** next to Same-Time and Road Shuffle, not a
destructive replacement. Albums, Outpost, Orchard, Record Shelf and reactions
stay in the app. Server HUM remains idempotent, and live *station* time is not
mistaken for a verified specific recording. Local Outpost song proof likewise
does not fabricate per-track listening from an unidentified HLS stream.

On a playback error the native UI reports Tower unavailable and leaves
the original Same-Time mode selectable; it does **not** yet automatically
handoff from Tower to Long Wave/Same-Time. That fallback should follow
with careful single-player continuity and station cue coordination.

## Still to prove

1. Build + JUnit, screenshot + actual Android 11 emulator launch.
2. Physical Android 11: sound from the actual live relay, screen-off,
   notification controls, interruptions, LTE↔Wi-Fi recovery.
3. Timed HLS cue alignment with audio playhead, title and artwork.
4. Live status discovery, multiple stations, Long Wave fallback chain.
5. Stable signing/data preservation before release.

**No release or stream cutover claim.** This is a stacked proposal depending
on Recovery 001; review it separately and keep both PRs draft until tested.
