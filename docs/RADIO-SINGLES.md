# HUMKIN RADIO — Explicit single designation (2026-11-16)

The private Crate Loader offers three mutually exclusive intake labels:

- **RADIO-ONLY SONG** — `kind='song'`, `is_single=false`. Plays once per normal cycle.
- **OFFICIAL SINGLE ✳** — `kind='song'`, `is_single=true`. The station's current `featured_rotation.multiplier=2` schedules a second play per base cycle in both Same-Time and Road Shuffle. Road Shuffle still tries to honor the one-hour repeat exclusion.
- **STATION BUMPER** — `kind='bumper'`, `is_single=false`. Operates under the independent owner-selected station-ID cadence, never as a music single.

Each upload is first a **private, unpublished crate draft**. Selecting SINGLE does not publish the recording or distribute it to outside music services. An owner must separately approve publication. The private review list labels singles. Later, the owner can change a *cloud* track's SINGLE status in Station Manager without reuploading it. Song title and album/collection remain editable.

## Persistence and migration

On 2026-11-16, the connected `pantry-gate` Supabase project received migration `humkin_radio_explicit_single_designation_v1`:

```sql
ALTER TABLE public.humkin_radio_tracks
  ADD COLUMN IF NOT EXISTS is_single boolean NOT NULL DEFAULT false;
```

The boolean is release metadata and **does not alter** the database's constrained `kind` values (`song` or `bumper`). Default false preserves existing uploaded tracks; website album releases and specifically named website singles continue to come from `fm/rotation.json` curated `featured_rotation` rather than inferred upload dates or album names.

**Source:** `fm/load/loader.js`, `fm/radio.js`, `fm/manage/manager.js`.

**Proof:** `node tests/radio-singles.test.cjs` plus full `node tests/radio.test.mjs`, which simulates a complete weighted clock cycle and verifies a single cloud file receives exactly two slots.

**Limits:** A merged code change, database column, and deployed webpage do not establish successful device upload or actual receiver playback. Browser audio conversion needs a real mobile test. A dedicated 24/7 stream remains a separate service.
