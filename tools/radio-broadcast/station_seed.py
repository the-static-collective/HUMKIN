"""Build a local Cloud Autopilot rehearsal from a Radio House Station Seed."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

from autopilot_publisher import CRATE_SCHEMA, STATION, TRACK, parse_time, prepare_tracks, public_program

SCHEMA = "humkin.radiohouse.station-seed/v1"
POLICY = {
    "editorial": {"roles": ["contributor", "reviewer", "publisher"], "authority": "human-review-required"},
    "automation": {"mode": "manual", "can_publish": False},
    "receiver": {"engine": "cloud_autopilot_hls"},
    "health": {"policy": "verify-hls-and-schedule"},
}
SEED_KEYS = {"schema", "station_id", "display_name", "owner", "clock", "media_sources",
             "programs", "provenance", *POLICY}


def record(value, keys, label):
    if not isinstance(value, dict) or value.keys() != set(keys.split()):
        raise ValueError(f"Invalid {label}")


def label(value):
    return isinstance(value, str) and bool(value.strip()) and len(value) <= 160


def identifier(pattern, value):
    return isinstance(value, str) and pattern.fullmatch(value)


def indexed_entries(entries, keys, name, limit):
    if not isinstance(entries, list) or not 1 <= len(entries) <= limit:
        raise ValueError(f"Expected 1–{limit} {name} entries")
    indexed = {}
    for entry in entries:
        record(entry, keys, name)
        if not identifier(TRACK, entry["id"]) or entry["id"] in indexed:
            raise ValueError(f"Invalid or duplicate {name} ID")
        if not label(entry["title"]):
            raise ValueError(f"Invalid {name} title")
        indexed[entry["id"]] = entry
    return indexed


def validate_seed(seed):
    if not isinstance(seed, dict) or seed.keys() != SEED_KEYS or seed["schema"] != SCHEMA:
        raise ValueError(f"Expected a complete {SCHEMA} document")
    station = seed["station_id"]
    if not identifier(STATION, station):
        raise ValueError("Invalid station ID")
    if station == "station-one":
        raise ValueError("Reserved station: station-one")
    if not label(seed["display_name"]) or not label(seed["owner"]):
        raise ValueError("Invalid station identity")
    for name, value in POLICY.items():
        if seed[name] != value:
            raise ValueError(f"Unsupported {name} policy")
    if seed["automation"]["can_publish"] is not False:
        raise ValueError("Automation publishing must be disabled")
    provenance = seed["provenance"]
    record(provenance, "source purpose", "provenance")
    if provenance["source"] != "generated-test-tones" or not label(provenance["purpose"]):
        raise ValueError("Expected generated test tone provenance")

    sources = indexed_entries(seed["media_sources"],
        "kind id title approval frequency_hz seconds", "media source", 12)
    for source in sources.values():
        if source["kind"] != "test-tone" or source["approval"] != "synthetic-rehearsal":
            raise ValueError("Invalid media source approval for this rehearsal")
        hz, seconds = source["frequency_hz"], source["seconds"]
        if type(hz) is not int or not 220 <= hz <= 1000:
            raise ValueError("Test tone frequency must be 220–1000 Hz")
        if type(seconds) is not int or not 10 <= seconds <= 60:
            raise ValueError("Test tone duration must be 10–60 seconds")

    programs = indexed_entries(seed["programs"], "id title tracks", "program", 12)
    for program in programs.values():
        order = program["tracks"]
        if (not isinstance(order, list) or not 1 <= len(order) <= 12 or
                any(not isinstance(track, str) or track not in sources for track in order)):
            raise ValueError("Program must reference 1–12 approved media sources")
    clock = seed["clock"]
    record(clock, "mode default_program timezone", "programming clock")
    selected = clock["default_program"]
    if (clock["mode"] != "loop" or clock["timezone"] != "UTC" or
            not isinstance(selected, str) or selected not in programs):
        raise ValueError("Expected a UTC loop with a valid default program")
    return programs[selected], sources


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def build(seed_file, effective_at, output):
    raw = seed_file.read_bytes()
    seed = json.loads(raw)
    selected, sources = validate_seed(seed)
    if output.exists():
        raise ValueError("Choose a new output directory")

    # Keep a failed encode from leaving a directory that looks ready to review.
    with tempfile.TemporaryDirectory(prefix=".station-seed-", dir=output.parent) as temporary:
        draft = Path(temporary) / "draft"
        media = draft / "media"
        media.mkdir(parents=True)
        tracks = []
        for track_id in selected["tracks"]:
            source = sources[track_id]
            relative_path = f"media/{track_id}.wav"
            target = draft / relative_path
            if not target.exists():
                tone = f"sine=frequency={source['frequency_hz']}:duration={source['seconds']}"
                subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
                                "-f", "lavfi", "-i", tone, "-c:a", "pcm_s16le", str(target)],
                               check=True)
            tracks.append({"id": track_id, "path": relative_path, "title": source["title"],
                           "artist": seed["display_name"], "album": selected["title"]})
        crate = draft / "crate.json"
        write_json(crate, {"schema": CRATE_SCHEMA, "station_id": seed["station_id"], "tracks": tracks})
        station, prepared = prepare_tracks(crate, draft / "cache")
        program = public_program(None, station, prepared, lead_seconds=0, now=effective_at)
        write_json(draft / "program.json", program)
        revision = program["revisions"][0]
        write_json(draft / "receipt.json", {
            "schema": "humkin.radiohouse.station-seed-receipt/v1",
            "stage": "prepared",
            "station_id": station,
            "seed_sha256": hashlib.sha256(raw).hexdigest(),
            "program_id": selected["id"],
            "revision": revision["id"],
            "effective_at": revision["effective_at"],
            "tracks": [{"id": track["id"], "source_sha256": track["asset_sha"],
                        "segments": len(track["durations_ms"])} for track in prepared],
        })
        draft.rename(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("seed", type=Path)
    parser.add_argument("--effective-at", required=True, help="Rehearsal start in UTC (ISO 8601 with Z)")
    parser.add_argument("--output", required=True, type=Path, help="New folder under an existing directory")
    args = parser.parse_args()
    try:
        build(args.seed, parse_time(args.effective_at), args.output.resolve())
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print("Station Seed preparation failed:", exc, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
