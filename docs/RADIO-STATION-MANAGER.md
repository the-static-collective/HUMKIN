# HUMKIN Radio · Station Manager

**Version:** November 13, 2026 · first owner console.
**Entry:** `https://humkin.abundent.org/fm/manage/` (owner session shared with the `/fm/load/` uploader).
**Time zone:** fixed `America/Chicago` (Central Time, with daylight-saving adjustments).

## What exists

- Record library of all public cloud tracks and the 21 legacy GitHub Pages radio tracks. The current live baseline before this release is 38 cloud + 21 legacy = 59 recordings.
- Search by title, artist, album, filename, or stable track ID. This is important because duplicate titles can refer to different recordings. Original filename and a unique ID are shown.
- Editable on-air title, artist credit, album, enabled/disabled switch, and recording type (song or bumper/station ID).
- Bulk hide/enable and in-browser track preview. An enabled **bumper** is excluded from general Road Shuffle and fallback Same-Time rotation; it plays only when explicitly placed in a scheduled show's running order.
- Cloud recordings have owner-only, two-step **permanent delete**: confirm + type DELETE. The client removes the actual audio using the Storage API, then deletes the table record, never deletes Storage metadata directly. Deletion of an object is irreversible, and programs referencing the ID will skip it. If the metadata delete fails after audio removal, the UI reports the partial failure. **HIDE** is the safe reversible choice.
- Legacy website tracks are editable through a metadata override table; the underlying GitHub binary assets are **not** removed from the website by a control-desk delete operation. HIDE removes them from the radio rotation only.
- Program editor allows recurring named time slots with selected weekdays, Central-time start/end, priority, enable/pause and an ordered list of track IDs (including repeats for bumpers). Multiple slots may overlap; higher priority wins, then later start time.
- All public schedule and metadata reads use Supabase Row Level Security; only the authenticated creator account `us@abundent.org` may mutate them. No service-role keys in a public web client.

## When listeners hear changes

Listeners must refresh the page or retune to load a new catalog/schedule. The player **Same-Time Radio** checks whether the current Central-time minute falls in an active program and loops that program's ordered track list against the program's starting time. If no applicable valid program is active, it falls back to the rotating songs (excluding bumper-only recordings). **Road Shuffle** remains nonprogrammed, no-repeat music shuffle.

Daypart switches in a foreground tab are normally detected at the next time update; when a phone is locked, browsers may suspend JavaScript so switching can be delayed until the next song ends or a tab becomes visible. The browser-only clock is an approximation, **not** an actual streaming automation server or sample-accurate broadcast. Real 24/7 radio scheduling with guaranteed timing requires a remote continuous stream and AutoDJ such as AzuraCast/Icecast.

## Studio operating flow

1. Sign in at the existing crate loader if needed, then open the Station Manager link.
2. Search duplicate names, open EDIT, set artist/title and save. If a song is unwanted, HIDE it. Label a short voice or station ID recording BUMPER.
3. Create a show, e.g. "Morning Drive": Monday–Friday, 07:00–09:00 Central, priority 1. Add songs and bumpers in the desired sequence. Save and leave enabled.
4. Test on `/fm/` in SAME-TIME mode after refresh. Road Shuffle will keep playing the enabled songs, not schedule blocks.
5. For a midnight-to-morning program, use two linked blocks (e.g. 22:00–23:59 and 00:00–02:00); this version deliberately does not support one cross-midnight entry. To cover the 23:59–00:00 minute, a future version can implement an end-of-day endpoint; current times stop at 23:59.

## Deployment boundaries

No music or program was renamed, hidden, deleted or created as part of building the console. Existing uploaded songs default to enabled SONG, so the published playlist should remain exactly as it was until the owner edits it. All user actions are explicit and reversible except the clearly labeled permanent audio delete. Tests cover deterministic daypart selection, recurring days, Central DST, overlapping priority, no missing ID crash, default rotation and UI script consistency.

There is no usage accounting, live DJ microphone input, crossfade, loudness normalization, server-side playout engine, ad insertion, BPM selection, listener stats, or scheduled podcast automation in this version; those are future extensions.
