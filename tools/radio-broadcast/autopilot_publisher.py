#!/usr/bin/env python3
"""HUMKIN cloud-autopilot prototype: prepare approved local MP3s and publish
an R2-backed shared program. The ordinary live/ and media/ paths are untouched.
No R2 credentials are written to files or printed.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

from autopilot_remote import verified_remote_file

SCHEMA = "humkin.cloud-autopilot/v1"
CRATE_SCHEMA = "humkin.autopilot.crate/v1"
BUCKET = "humkin-radio-live"
STATION = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")
TRACK = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
SEGMENT = re.compile(r"^segment-([0-9]{6})\.ts$")
EPOCH = dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)


def iso(timestamp):
    return timestamp.astimezone(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_time(value):
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError("A revision must have a UTC timestamp")
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.astimezone(dt.timezone.utc)


def clock_ms(value):
    return int((parse_time(value) - EPOCH).total_seconds() * 1000)


def utcnow():
    return dt.datetime.now(dt.timezone.utc)


def asset_digest(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class ShortFinalSegment(ValueError):
    """FFmpeg ended a valid audio track with a final HLS tail below 250 ms."""


def segments_from_manifest(manifest, directory):
    durations = []
    waiting = None
    for line in manifest.read_text(encoding="utf-8").splitlines():
        if line.startswith("#EXTINF:"):
            if waiting is not None:
                raise ValueError("Malformed HLS manifest: missing segment")
            waiting = round(float(line.split(":", 1)[1].split(",", 1)[0]) * 1000)
        elif line and not line.startswith("#"):
            match = SEGMENT.fullmatch(line)
            if not match or waiting is None or int(match.group(1)) != len(durations):
                raise ValueError("Malformed HLS manifest: segment mismatch")
            file = directory / line
            if not file.is_file() or file.stat().st_size == 0 or not 0 < waiting <= 11000:
                raise ValueError("Invalid/missing AAC segment: " + line)
            durations.append(waiting)
            waiting = None
    if waiting is not None or not durations:
        raise ValueError("Empty or unfinished AAC manifest")
    # The cloud Worker requires every advertised segment to last >=250 ms.
    # A track lasting 184.08 seconds, for instance, produces 23 eight-second
    # segments and an unusably short 80 ms tail. Change *encoding boundaries*,
    # never the original audio or the Worker validation contract.
    if len(durations) >= 2 and durations[-1] < 250 and all(
            length >= 250 for length in durations[:-1]):
        raise ShortFinalSegment("AAC final segment below 250 ms")
    if any(length < 250 for length in durations):
        raise ValueError("Invalid AAC segment duration")
    return durations


def _encoded_segments(src, digest, cache):
    """Encode once per digest, retrying only FFmpeg's short final segment.

    Slightly changing HLS chunk width avoids a <250 ms last fragment without
    modifying song duration, trimming audio, or weakening Worker requirements.
    An already valid cache is reused. All attempts use the same source bytes.
    """
    target = cache / digest
    target.mkdir(parents=True, exist_ok=True)
    manifest = target / "track.m3u8"
    if manifest.exists():
        try:
            return segments_from_manifest(manifest, target)
        except ShortFinalSegment:
            print("Re-encoding old cache with a short AAC tail:", digest[:12])
    for seconds in ("8", "7.6", "8.4", "7.2", "8.8", "9.1"):
        # Remove only our own generated output; never delete sources or pins.
        manifest.unlink(missing_ok=True)
        for stale in target.glob("segment-*.ts"):
            stale.unlink()
        command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(src), "-map", "0:a:0", "-vn", "-c:a", "aac",
            "-b:a", "128k", "-ar", "44100", "-ac", "2",
            "-f", "hls", "-hls_time", seconds, "-hls_list_size", "0",
            "-hls_playlist_type", "vod", "-hls_segment_filename",
            str(target / "segment-%06d.ts"), str(manifest)]
        subprocess.run(command, check=True)
        try:
            return segments_from_manifest(manifest, target)
        except ShortFinalSegment:
            print("Short AAC final segment at", seconds,
                  "seconds; retrying with a different chunk width")
    raise ValueError("AAC encoding produced short final segments at every safe chunk width")


def _remote_pin_path(cache, handoff):
    fingerprint = handoff["fingerprint"]
    if not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
        raise ValueError("Invalid remote handoff fingerprint.")
    return cache / "handoffs" / (fingerprint + ".json")


def prepare_tracks(input_path, cache, *, publish=False):
    """Prepare files or published remote MP3s without requiring a local master.

    Published remote sources are downloaded only into disposable temp files.
    A successful preview records SHA-256 pins in the private AAC cache.
    Publishing requires the same handoff and byte-for-byte remote media.
    """
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    handoff = None
    if payload.get("schema") == "humkin.cloud-house-selection/v1":
        from house_rotation import catalog_rows, validate_selection, crate_from_selection
        # The public catalog is checked on BOTH preview and publish. Remote
        # objects do not become eligible just because a stale draft says so.
        validate_selection(payload, catalog_rows())
        handoff = payload  # existing source-pins receipt gates remote publish
        payload = crate_from_selection(payload)
    if payload.get("schema") == "humkin.tower.cloud-handoff/v1":
        from tower_cloud_handoff import validate_handoff
        validate_handoff(payload)
        handoff = payload
        payload = payload["crate"]
    if payload.get("schema") != CRATE_SCHEMA:
        raise ValueError("Expected " + CRATE_SCHEMA)
    station = payload.get("station_id", "station-one")
    if not STATION.fullmatch(station):
        raise ValueError("Invalid station id")
    sources = payload.get("tracks")
    if not isinstance(sources, list) or not 1 <= len(sources) <= 500:
        raise ValueError("Expected 1–500 explicitly approved audio files")
    cache = Path(cache)
    tracks, remote_pins, remote_seen = [], [], {}
    pin_path = _remote_pin_path(cache, handoff) if handoff else None
    prior_pins = None
    if publish and handoff and any("url" in item for item in sources):
        if not pin_path.is_file():
            raise ValueError("Preview this remote show first; the source checksum receipt is missing.")
        prior = json.loads(pin_path.read_text(encoding="utf-8"))
        if prior.get("schema") != "humkin.autopilot.source-pins/v1" or prior.get("fingerprint") != handoff["fingerprint"]:
            raise ValueError("The remote preview receipt is incompatible with this show.")
        prior_pins = prior.get("remote_tracks")
        if not isinstance(prior_pins, list):
            raise ValueError("The remote preview receipt is invalid.")
    for item in sources:
        if not isinstance(item, dict):
            raise ValueError("Invalid approved recording entry.")
        path = item.get("path")
        remote_url = item.get("url")
        if isinstance(path, str) and path and remote_url is None:
            src = Path(path).expanduser()
            if not src.is_absolute():
                src = input_path.parent / src
            src = src.resolve(strict=True)
            if not src.is_file() or src.stat().st_size > 500 * 1024 * 1024:
                raise ValueError("Audio file missing or too large")
            digest = asset_digest(src)
            durations = _encoded_segments(src, digest, cache)
            label = src.stem
        elif (isinstance(remote_url, str) and remote_url
              and path is None and handoff is not None):
            source = item.get("source_kind")
            expected = item.get("expected_sha")
            # Even a reused URL is checked against the current handoff metadata.
            from autopilot_remote import published_audio_url
            published_audio_url(remote_url, source)
            memo = (remote_url, source, expected)
            if memo in remote_seen:
                digest, durations = remote_seen[memo]
            else:
                with verified_remote_file(remote_url, source, cache,
                                          expected_sha=expected) as (temp, digest):
                    durations = _encoded_segments(temp, digest, cache)
                remote_seen[memo] = (digest, durations)
            label = ""
            remote_pins.append({"id": item.get("id"), "url": remote_url,
                                "sha256": digest})
        else:
            raise ValueError("An approved track needs exactly one safe local or published remote source.")
        name = str(item.get("title") or label).strip()[:160]
        if not name:
            raise ValueError("Tracks require titles")
        item_id = str(item.get("id") or ("track-" + digest[:20]))
        if not TRACK.fullmatch(item_id):
            raise ValueError("Invalid track id")
        artwork = str(item.get("artwork") or "").strip()
        if artwork and not artwork.startswith("https://"):
            raise ValueError("Artwork must use an approved public HTTPS URL")
        tracks.append({
            "id": item_id, "title": name,
            "artist": str(item.get("artist") or "HUMKIN")[:160],
            "album": str(item.get("album") or "")[:160],
            "artwork": artwork[:1000], "asset_sha": digest,
            "durations_ms": durations})
        print("Prepared:", name, "—", len(durations), "segments")
    if remote_pins and handoff:
        if publish:
            if remote_pins != prior_pins:
                raise ValueError("Remote audio changed since preview; preview the show again.")
        else:
            pin_path.parent.mkdir(parents=True, exist_ok=True)
            receipt = {"schema": "humkin.autopilot.source-pins/v1",
                       "fingerprint": handoff["fingerprint"],
                       "remote_tracks": remote_pins}
            temp = pin_path.with_suffix(".tmp")
            try:
                temp.write_text(json.dumps(receipt, sort_keys=True), encoding="utf-8")
                temp.replace(pin_path)
            finally:
                temp.unlink(missing_ok=True)
            print("Pinned", len(remote_pins), "remote recording slots for owner review.")
    return station, tracks


def next_boundary(previous, earliest_ms):
    start = clock_ms(previous["effective_at"])
    positions = [0]
    total = 0
    for track in previous["tracks"]:
        total += sum(track["durations_ms"])
        positions.append(total)
    if total <= 0:
        raise ValueError("Existing program has no duration")
    if earliest_ms <= start:
        return start
    cycles = (earliest_ms - start) // total
    within = earliest_ms - start - cycles * total
    for point in positions:
        if point >= within:
            return start + cycles * total + point
    return start + (cycles + 1) * total


def next_effective(revisions, lead_seconds, now=None):
    reference = now or utcnow()
    earliest = round(reference.timestamp() * 1000) + lead_seconds * 1000
    if revisions:
        last = revisions[-1]
        earliest = max(earliest, clock_ms(last["effective_at"]) + 1000)
        earliest = next_boundary(last, earliest)
    return dt.datetime.fromtimestamp(earliest / 1000, tz=dt.timezone.utc)


def public_program(existing, frequency, tracks, lead_seconds=120, *, now=None):
    if existing:
        if existing.get("schema") != SCHEMA or existing.get("station_id") != frequency:
            raise ValueError("Existing cloud program is incompatible. Refusing to overwrite.")
        revisions = list(existing.get("revisions", []))
        if not revisions or len(revisions) >= 32:
            raise ValueError("Existing revision history needs review before another publication.")
    else:
        revisions = []
    when = next_effective(revisions, lead_seconds, now=now)
    revision = {"id": "r-" + when.strftime("%Y%m%d%H%M%S") + "-" +
        hashlib.sha256(json.dumps(tracks,sort_keys=True).encode()).hexdigest()[:10],
        "effective_at": iso(when), "tracks": tracks}
    revisions.append(revision)
    return {"schema": SCHEMA, "station_id": frequency, "revisions": revisions}


def publish_program(program, cache, client, new_revision_count=1):
    from botocore.exceptions import ClientError
    # Media first, schedule last: an interrupted upload cannot announce missing audio.
    if not 1 <= new_revision_count <= len(program["revisions"]):
        raise ValueError("Invalid publication revision count")
    uploaded = set()
    for revision in program["revisions"][-new_revision_count:]:
        for track in revision["tracks"]:
            sha = track["asset_sha"]
            for index in range(len(track["durations_ms"])):
                key = f"autopilot/segments/{sha}/segment-{index:06d}.ts"
                if key in uploaded:
                    continue
                uploaded.add(key)
                local = cache / sha / f"segment-{index:06d}.ts"
                try:
                    client.head_object(Bucket=BUCKET, Key=key)
                    continue
                except ClientError as exc:
                    if exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 404:
                        raise
                if not local.is_file():
                    raise FileNotFoundError("Approved R2 segment missing from both cache and cloud: "+key)
                client.upload_file(str(local), BUCKET, key, ExtraArgs={
                    "ContentType":"video/mp2t", "CacheControl":"public, max-age=31536000, immutable"})
    station = program["station_id"]
    key = f"autopilot/programs/{station}.json"
    # Recheck the latest revision before overwriting the program pointer.
    try:
        existing = json.loads(client.get_object(Bucket=BUCKET, Key=key)["Body"].read())
    except ClientError as exc:
        if exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 404:
            raise
        existing = None
    if existing and existing.get("revisions", []) != program["revisions"][:-new_revision_count]:
        raise RuntimeError("Cloud program changed while preparing; reload before publishing.")
    raw = json.dumps(program, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    client.put_object(Bucket=BUCKET, Key=key, Body=raw,
                      ContentType="application/json", CacheControl="no-store")
    print("Published cloud program:", station)
    for revision in program["revisions"][-new_revision_count:]:
        print("Revision:", revision["id"], "at", revision["effective_at"])


def main():
    parser = argparse.ArgumentParser(description="Prepare/cloud-publish HUMKIN's clock-owned radio")
    sources = parser.add_mutually_exclusive_group(required=True)
    sources.add_argument("--input", help="Local approved track list JSON")
    sources.add_argument("--tower-program", help="Unapproved Tower handoff JSON; owner must review before publication")
    sources.add_argument("--house-selection", help="Owner-reviewed draft generated from current approved R2 catalog; remote sources checked again")
    parser.add_argument("--cache", default=str(Path(os.environ.get("LOCALAPPDATA",
        str(Path.home()))) / "HUMKIN" / "Autopilot"))
    parser.add_argument("--publish", action="store_true", help="Upload segments and commit the schedule")
    parser.add_argument("--approved-packet", help="Owner-reviewed Gambit proposal packet; schedules guest and automatic house return")
    parser.add_argument("--lead-seconds", type=int, default=120)
    args = parser.parse_args()
    if not 30 <= args.lead_seconds <= 86400:
        parser.error("Lead time must be 30–86400 seconds")
    if (args.tower_program or args.house_selection) and args.approved_packet:
        parser.error("Saved Tower/house selections and Gambit proposals are separate scheduling paths.")
    manifest = Path(args.tower_program or args.house_selection or args.input).resolve(strict=True)
    cache = Path(args.cache)
    handoff = None
    if args.tower_program:
        from tower_cloud_handoff import validate_handoff
        handoff = json.loads(manifest.read_text(encoding="utf-8"))
        station, requested = validate_handoff(handoff)
        print("Tower program:", handoff["program"]["name"],
              "revision", handoff["program"]["revision"])
        print("Requested Central slot:", handoff["slot"]["day"], handoff["slot"]["time"])
    station, tracks = prepare_tracks(manifest, cache, publish=args.publish)
    if args.house_selection:
        print("HOUSE source approval rechecked:", len(tracks), "songs")
        print("This changes the HOUSE cycle only if explicitly published.")
    if handoff:
        from tower_cloud_handoff import validate_prepared
        validate_prepared(handoff, tracks)
    reviewed = None
    if args.approved_packet:
        from program_deck import validate_packet, select_deck
        reviewed = json.loads(Path(args.approved_packet).resolve(strict=True).read_text(encoding="utf-8"))
        validate_packet(reviewed, station)
        tracks = select_deck(reviewed, tracks, station)
        print("Gambit preview:", len(tracks), "approved songs in priority order")
        print("Requested guest window:", reviewed["proposal"]["day"], reviewed["proposal"]["time"],
              "Central,", reviewed["proposal"]["minutes"], "minutes")
    if not args.publish:
        if handoff:
            print("Running order preserved:", " / ".join(track["id"] for track in tracks))
            print("A seeded house Cloud Autopilot schedule is required before publishing.")
        print("PREVIEW ONLY: no public schedule was changed. Use --publish after review.")
        print("Total cycle seconds:", sum(sum(t["durations_ms"]) for t in tracks) / 1000)
        return
    # Reuse the already installed publisher's boto3 credentials contract.
    from botocore.exceptions import ClientError
    from hls_push import r2_client
    client = r2_client()
    key = f"autopilot/programs/{station}.json"
    try:
        existing = json.loads(client.get_object(Bucket=BUCKET, Key=key)["Body"].read())
    except ClientError as exc:
        status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if status not in (404,):
            raise
        existing = None
    if handoff:
        from tower_cloud_handoff import schedule_curated
        program = schedule_curated(existing, station, tracks, handoff)
        for revision in program["revisions"][-2:]:
            print("Scheduled", revision["id"], "at", revision["effective_at"])
        publish_program(program, cache, client, new_revision_count=2)
    elif reviewed:
        from program_deck import schedule_guest
        program = schedule_guest(existing, station, tracks, reviewed)
        for revision in program["revisions"][-2:]:
            print("Scheduled", revision["id"], "at", revision["effective_at"])
        publish_program(program, cache, client, new_revision_count=2)
    else:
        program = public_program(existing, station, tracks, args.lead_seconds)
        publish_program(program, cache, client)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as exc:
        print("Autopilot did not publish:", exc, file=sys.stderr)
        sys.exit(1)
