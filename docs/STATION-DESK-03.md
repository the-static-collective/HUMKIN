# HUMKIN RADIO — Station Desk 0.3 / The Radio Black Box + Station Lab

**Status:** reviewable code. This does not activate Icecast, change a station schedule,
add cloud telemetry, track listeners, or prove a particular song was received.

## 1. Something sounded wrong (browser)

The website loads `fm/black-box.js` before `fm/radio.js`. The recorder keeps at
most 160 recent **local-memory** events in the open browser tab: ready/error,
selected source, mode changes, audio started/paused, end-boundaries, waiting,
stalls, and autoplay/play rejection. No recording of microphone/audio; no remote
logging, cookie, listener ID, raw media URL, network headers, passwords or free-text
messages. The sanitized keys are explicit in `black-box.js`.

When a listener presses **? SOMETHING SOUNDED WRONG**, the site exports
`humkin-signal-report.json` locally. The user may choose whether to send that file
to the Station Desk for interpretation. It is not uploaded automatically.
Browser restart clears this bounded buffer. Existing Top 42 play submissions
remain separate from Black Box and are not changed by this feature.

The iPhone/PWA engine also loads the recorder, but its compact page has no
export button yet. Its data remains in memory unless a future owner-reviewed
export is added. The Android native APK is not instrumented by this change.

### Interpreting a browser report

Upload the JSON to the Station Desk, or inspect it locally:

```sh
python tools/radio-broadcast/station_lab.py --inspect-black-box humkin-signal-report.json
```

The result counts errors, stalls, attempted source selections and consecutive
repeat selections. It is a diagnostic lead, **not proof of exact root cause**:
missing `ended` events, mobile tab suspension and CORS differences still need
device-specific testing.

## 2. Private Python broadcaster log (optional)

The source `engine.py` gains one **opt-in** local argument:

```sh
python tools/radio-broadcast/engine.py --cache ./radio-cache --black-box-file ./private/radio-events.jsonl
```

Only enable broadcasting after separate Icecast credentials/host setup. The
`--black-box-file` option itself does not open a transmitter or publish anything.
Each line uses `humkin.radio.blackbox/v1` event identifiers and a small allowed
field set. Log files roll over locally at 5 MiB (single previous file). They
never include URLs or credentials. Source-selection events are **not** proof
that a downstream listener heard the recording. Store private copies carefully;
delete them when no longer useful.

## 3. Station Lab — compare policies with no live changes

Use the real `scheduler_v2.StationV2` selector in a simulated timeline:

```sh
# Use a local StationV2 catalog JSON fixture; no internet access required.
python tools/radio-broadcast/station_lab.py --fixture ./my-station-catalog.json \
  --days 30 --seed 2026 --candidate-bumper-every 3 \
  --candidate-release-multiplier 2 --out ./station-lab-report.json

# Or request the current published, enabled, public radio catalog at run-time.
python tools/radio-broadcast/station_lab.py --live --days 7 \
  --candidate-bumper-every 3 --out ./station-lab-report.json
```

Baseline retains the catalog's existing published settings; candidate changes
only explicitly named programming parameters, in a **deep copy**. All selections
are synthetic: no media files are downloaded or played, no cloud rows are
modified, and no R2 objects are touched.

Reported measures include music/break airtime, diversity, repeat distances,
short-gap bumper repeats, longest music-only stretches, and the first 12
selection decisions. Simulation is deterministic for a given catalog, start
time and seed; compare several seeds before deciding a rule is robust.
It does not model actual browser clock behavior, transport/codec failures,
crossfades, listener counts, live feed health or mobile backgrounding.

The output has a clear `humkin.radio.station-lab/v1` schema. A Station Desk
plugin can inspect the receipt and suggest a policy change, **but must not
apply that change** without owner approval.

## 4. Evidence boundaries / next validation

- **Implemented code:** bounded browser trace; voluntary JSON export; matching
  optional source JSONL trace; reproducible policy comparison CLI; tests.
- **Requires verification:** CI on the review branch, browser spot-check on a
  real mobile device, and Python local dry-run/fixture test.
- **Not implemented:** a server-side event collector, real listener analytics,
  automatic fault repair, production 24/7 health supervision, a native Android
  export, or one identical browser/Python scheduler. Those are separate steps.
- **Rollback:** revert the review PR. Exported reports remain local; this PR
  introduces no persistent cloud data or database migration.
