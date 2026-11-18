# HUMKIN Radio — Magnetic Groups & Optional Rules

**Owner access:** [Station Manager](https://humkin.abundent.org/fm/manage/) via the existing Crate Loader Supabase sign-in. This is a station-control UI, not a public group-editing feature.

## Magnetic groups (owner-authored only)

Select two or more published bumper recordings, including disabled-but-published copies. Give the group a name, choose a type, and save. Every group has its own ON/OFF control, EDIT and DELETE. No audio object is changed.

- **ATTRACT** — related recordings may move into the next three bumper breaks if a compatible slot remains within a shuffled bag. It does not force adjacency or repeat a recording for a theme.
- **REPEL** — avoid playing different-length versions of the same recording within three bumper breaks when a substitute remains within that lane's current bag.
- **No automatic categorization.** Similar titles, speakers, bells, comedy, genres, subjects, characters and release shelves do not imply a group. Owner may deliberately choose either relation for *any* two published bumper recordings.
- The owner can select bumpers in the Record Library and choose **GROUP CHECKED LIBRARY BUMPERS** or build a group from search.
- The existing φ short drops / medium / long breaks retain their timing. All group permutations keep the selected recording multiset and original Same-Time total duration. A request may be impossible in the next available slots; in that case normal fair shuffle wins.

## Optional rules (OFF unless owner explicitly enables)

All formerly inferred editorial holds were removed. A title containing "top of the hour," "requests," "sign-off," or "opener" has **no automatic special authority**.

Create a named rule, select published bumpers, choose its type, and optionally enable:

- **Manual hold:** keep selected recordings out of *automatic* bumper slots until disabled again. Active scheduled shows remain separately managed.
- **Days & hours:** allow selected recordings only inside specified America/Chicago weekdays and time window. Overnight ranges require two rules.
- **Calendar dates:** allow selected recordings only between the selected start and end dates, inclusive.

Rules, like groups, can be paused, edited or deleted; never delete original audio. Newly authored rules default OFF. New recurring show programs also default PAUSED until explicitly enabled. Existing show settings are not secretly rewritten.

**Clock boundary:** Manual holds work on browser Same-Time, Road Shuffle, Station One and Long Wave. Date/time rules work in Road Shuffle and stream sources at completed recording boundaries. The browser Same-Time clock intentionally ignores variable day/date restrictions, because its shared epoch assumes a fixed cycle duration.

## Persistence and privacy

The existing RLS-protected `public.humkin_radio_settings` row contains `bumper_groups` and `bumper_rules` JSONB arrays (both default `[]`). Only the authenticated HUMKIN owner may update; the runtime reads only public programming metadata. Names of groups and rules are therefore **public metadata**. The editor offers only *published* bumper records to avoid leaking unreviewed drafts. No passwords, private requests or caller audio are stored here.

The browser and Python/FFmpeg source load fresh settings on startup or refresh. The optional Cloudflare Long Wave Worker reads settings with its regular public catalog request, refreshing its cached metadata periodically; it is not a deployed continuous transmitter merely because code exists.

## Validation

Unit tests: `node tests/bumper-brain.test.cjs`, `node tests/bumper-relations.test.cjs`, `python tests/station-one-v2.test.py`, `node --test tools/radio-broadcast/cloudflare/worker.test.mjs`. GitHub Actions validate website, Windows streaming source and Long Wave independently.
