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
            if not file.is_file() or file.stat().st_size == 0 or not 250 <= waiting <= 11000:
                raise ValueError("Invalid/missing AAC segment: " + line)
            durations.append(waiting)
            waiting = None
    if waiting is not None or not durations:
        raise ValueError("Empty or unfinished AAC manifest")
    return durations


def prepare_tracks(input_path, cache):
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    if payload.get("schema") != CRATE_SCHEMA:
        raise ValueError("Expected " + CRATE_SCHEMA)
    station = payload.get("station_id", "station-one")
    if not STATION.fullmatch(station):
        raise ValueError("Invalid station id")
    sources = payload.get("tracks")
    if not isinstance(sources, list) or not 1 <= len(sources) <= 500:
        raise ValueError("Expected 1–500 explicitly approved audio files")
    tracks = []
    for item in sources:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            raise ValueError("A track needs a local audio path")
        src = Path(item["path"]).expanduser()
        if not src.is_absolute():
            src = input_path.parent / src
        src = src.resolve(strict=True)
        if not src.is_file() or src.stat().st_size > 500 * 1024 * 1024:
            raise ValueError("Audio file missing or too large")
        digest = asset_digest(src)
        target = cache / digest
        target.mkdir(parents=True, exist_ok=True)
        manifest = target / "track.m3u8"
        if not manifest.exists():
            command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(src), "-map", "0:a:0", "-vn", "-c:a", "aac",
                "-b:a", "128k", "-ar", "44100", "-ac", "2",
                "-f", "hls", "-hls_time", "8", "-hls_list_size", "0",
                "-hls_playlist_type", "vod", "-hls_segment_filename",
                str(target / "segment-%06d.ts"), str(manifest)]
            subprocess.run(command, check=True)
        durations = segments_from_manifest(manifest, target)
        name = str(item.get("title") or src.stem).strip()[:160]
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
    return station, tracks


def next_boundary(previous, earliest_ms):
    start = clock_ms(previous["effective_at"])
    positions = [0]
    total = 0
    for track in previous["tracks"]:
        for duration in track["durations_ms"]:
            total += duration
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


def public_program(existing, frequency, tracks, lead_seconds=120):
    if existing:
        if existing.get("schema") != SCHEMA or existing.get("station_id") != frequency:
            raise ValueError("Existing cloud program is incompatible. Refusing to overwrite.")
        revisions = list(existing.get("revisions", []))
        if not revisions or len(revisions) >= 32:
            raise ValueError("Existing revision history needs review before another publication.")
    else:
        revisions = []
    when = next_effective(revisions, lead_seconds)
    revision = {"id": "r-" + when.strftime("%Y%m%d%H%M%S") + "-" +
        hashlib.sha256(json.dumps(tracks,sort_keys=True).encode()).hexdigest()[:10],
        "effective_at": iso(when), "tracks": tracks}
    revisions.append(revision)
    return {"schema": SCHEMA, "station_id": frequency, "revisions": revisions}


def publish_program(program, cache, client):
    # Media first, schedule last: an interrupted upload cannot announce missing audio.
    uploaded = set()
    for revision in program["revisions"][-1:]:
        for track in revision["tracks"]:
            sha = track["asset_sha"]
            for index in range(len(track["durations_ms"])):
                key = f"autopilot/segments/{sha}/segment-{index:06d}.ts"
                if key in uploaded:
                    continue
                uploaded.add(key)
                local = cache / sha / f"segment-{index:06d}.ts"
                if not local.is_file():
                    raise FileNotFoundError(str(local))
                try:
                    client.head_object(Bucket=BUCKET, Key=key)
                    continue
                except client.exceptions.ClientError as exc:
                    if exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") not in (403, 404):
                        raise
                client.upload_file(str(local), BUCKET, key, ExtraArgs={
                    "ContentType":"video/mp2t", "CacheControl":"public, max-age=31536000, immutable"})
    station = program["station_id"]
    key = f"autopilot/programs/{station}.json"
    # Recheck the latest revision before overwriting the program pointer.
    try:
        existing = json.loads(client.get_object(Bucket=BUCKET, Key=key)["Body"].read())
    except client.exceptions.NoSuchKey:
        existing = None
    if existing and existing.get("revisions", []) != program["revisions"][:-1]:
        raise RuntimeError("Cloud program changed while preparing; reload before publishing.")
    raw = json.dumps(program, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    client.put_object(Bucket=BUCKET, Key=key, Body=raw,
                      ContentType="application/json", CacheControl="no-store")
    print("Published cloud program:", station)
    print("Revision:", program["revisions"][-1]["id"])
    print("Takes effect:", program["revisions"][-1]["effective_at"])


def main():
    parser = argparse.ArgumentParser(description="Prepare/cloud-publish HUMKIN's clock-owned radio")
    parser.add_argument("--input", required=True, help="Local approved track list JSON")
    parser.add_argument("--cache", default=str(Path(os.environ.get("LOCALAPPDATA",
        str(Path.home()))) / "HUMKIN" / "Autopilot"))
    parser.add_argument("--publish", action="store_true", help="Upload segments and commit the schedule")
    parser.add_argument("--lead-seconds", type=int, default=120)
    args = parser.parse_args()
    if not 30 <= args.lead_seconds <= 86400:
        parser.error("Lead time must be 30–86400 seconds")
    manifest = Path(args.input).resolve(strict=True)
    cache = Path(args.cache)
    station, tracks = prepare_tracks(manifest, cache)
    if not args.publish:
        print("PREVIEW ONLY: no public schedule was changed. Use --publish after review.")
        print("Total cycle seconds:", sum(sum(t["durations_ms"]) for t in tracks) / 1000)
        return
    # Reuse the already installed publisher's boto3 credentials contract.
    from hls_push import r2_client
    client = r2_client()
    key = f"autopilot/programs/{station}.json"
    try:
        existing = json.loads(client.get_object(Bucket=BUCKET, Key=key)["Body"].read())
    except client.exceptions.ClientError as exc:
        status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if status not in (404,):
            raise
        existing = None
    program = public_program(existing, station, tracks, args.lead_seconds)
    publish_program(program, cache, client)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as exc:
        print("Autopilot did not publish:", exc, file=sys.stderr)
        sys.exit(1)
