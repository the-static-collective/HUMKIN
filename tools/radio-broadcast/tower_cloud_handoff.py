"""Source-bound bridge from a saved local Tower program to Cloud Autopilot.

A Tower handoff is NOT approval or a cloud schedule. Only the existing
credential-holding Autopilot publisher can commit a revision after owner review.
"""
from datetime import date, datetime, time, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
import re

from now_playing import artwork_url
from autopilot_remote import published_audio_url
from tower_programming import _stored

SCHEMA = "humkin.tower.cloud-handoff/v1"
CRATE_SCHEMA = "humkin.autopilot.crate/v1"
STATION = re.compile(r"[a-z0-9][a-z0-9-]{0,31}\Z")
UPLOAD = re.compile(r"upload-([0-9a-f]{64})\Z")
TRACK = re.compile(r"[a-z0-9][a-z0-9-]{0,79}\Z")
PROG = re.compile(r"[0-9a-f]{24}\Z")
UTC = timezone.utc
MAX_DURATION_MS = 8 * 60 * 60 * 1000


def checked_slot(day, clock):
    if not isinstance(day, str) or not isinstance(clock, str):
        raise ValueError("Choose a date and Central time for the program.")
    try:
        if date.fromisoformat(day).isoformat() != day:
            raise ValueError("Invalid program date")
        parsed = time.fromisoformat(clock)
        if parsed.isoformat(timespec="minutes") != clock:
            raise ValueError("Use HH:MM Central time")
    except (ValueError, TypeError) as exc:
        raise ValueError("Use YYYY-MM-DD and HH:MM Central time.") from exc
    if parsed.second or parsed.minute % 15:
        raise ValueError("Cloud programs start on a quarter-hour.")
    from program_deck import proposed_utc
    return proposed_utc(date.fromisoformat(day), parsed)


def _fingerprint(packet):
    protected = {key: packet[key] for key in ("station_id", "program", "slot", "crate")}
    return sha256(json.dumps(protected, ensure_ascii=False, sort_keys=True,
                            separators=(",", ":")).encode("utf-8")).hexdigest()


def export_handoff(desk, request):
    """Create one downloadable, unapproved local proposal. Never save or publish."""
    if not desk.tower:
        raise ValueError("Cloud handoffs require the Acer Tower media crate.")
    _, program = _stored(desk, request)
    day, clock = request.get("day"), request.get("time")
    when = checked_slot(day, clock)
    if when <= datetime.now(UTC) + timedelta(minutes=3):
        raise ValueError("Choose a slot at least three minutes in the future.")
    tracks = program["track_ids"]
    if not 1 <= len(tracks) <= 250:
        raise ValueError("A cloud program must contain 1–250 recordings.")
    desk.tower.find_tracks(desk.station.by_id)
    prepared = []
    for id_ in tracks:
        if not isinstance(id_, str) or not TRACK.fullmatch(id_):
            raise ValueError("A program recording has an unsupported Cloud Autopilot ID.")
        item = desk.station.by_id.get(id_)
        if not item or not desk.eligible(id_):
            raise ValueError(f"Recording unavailable or held for cloud: {id_}")
        art = str(item.get("artwork") or "")
        if art and artwork_url(art) != art:
            raise ValueError("Only approved HTTPS artwork can be exported.")
        record = {
            "id": id_,
            "title": str(item.get("title") or "")[:160],
            "artist": str(item.get("artist") or "HUMKIN")[:160],
            "album": str(item.get("album") or "")[:160],
            "artwork": art,
        }
        path = item.get("local_audio")
        if isinstance(path, str) and path:
            try:
                file = Path(path).resolve(strict=True)
            except OSError as exc:
                raise ValueError(f"Local cloud source is missing: {id_}") from exc
            if not file.is_file() or not 0 < file.stat().st_size <= 500 * 1024 * 1024:
                raise ValueError(f"Local cloud source is unavailable or too large: {id_}")
            if item.get("source") == "upload" and not file.is_relative_to(desk.tower.media.resolve()):
                raise ValueError("An imported track must remain inside the approved media crate.")
            record["path"] = str(file)
        else:
            # URL originates from the current Tower's published catalogue, not
            # a user-provided arbitrary address. CLI independently revalidates.
            source = item.get("source")
            record["url"] = published_audio_url(item.get("url"), source)
            record["source_kind"] = source
        digest = UPLOAD.fullmatch(id_)
        declared = item.get("sha256")
        if digest:
            record["expected_sha"] = digest.group(1)
        elif isinstance(declared, str) and re.fullmatch(r"[0-9a-f]{64}", declared):
            record["expected_sha"] = declared
        prepared.append(record)
    snapshot = {
        "schema": SCHEMA,
        "state": "draft_for_owner_review",
        "station_id": desk.tower.frequency,
        "program": {key: program[key] for key in ("id", "revision", "name", "notes", "track_ids")},
        "slot": {"day": day, "time": clock, "timezone": "America/Chicago"},
        "crate": {"schema": CRATE_SCHEMA, "station_id": desk.tower.frequency,
                  "tracks": prepared},
    }
    snapshot["fingerprint"] = _fingerprint(snapshot)
    return snapshot


def validate_handoff(packet):
    if not isinstance(packet, dict) or packet.get("schema") != SCHEMA:
        raise ValueError("Expected a Tower cloud handoff packet.")
    if packet.get("state") != "draft_for_owner_review":
        raise ValueError("A handoff must remain an unapproved draft.")
    station = packet.get("station_id")
    if not isinstance(station, str) or not STATION.fullmatch(station):
        raise ValueError("Invalid Tower cloud frequency.")
    prog, slot, crate = (packet.get(key) for key in ("program", "slot", "crate"))
    if not isinstance(prog, dict) or not isinstance(slot, dict) or not isinstance(crate, dict):
        raise ValueError("Cloud handoff is incomplete.")
    if (not isinstance(prog.get("id"), str) or not PROG.fullmatch(prog["id"])
            or type(prog.get("revision")) is not int or prog["revision"] < 1):
        raise ValueError("Saved program identity or revision invalid.")
    if (not isinstance(prog.get("name"), str) or not 1 <= len(prog["name"]) <= 120
            or not isinstance(prog.get("notes"), str) or len(prog["notes"]) > 1000):
        raise ValueError("Saved program metadata invalid.")
    if slot.get("timezone") != "America/Chicago":
        raise ValueError("Only Central-time slots are currently supported.")
    requested = checked_slot(slot.get("day"), slot.get("time"))
    if crate.get("schema") != CRATE_SCHEMA or crate.get("station_id") != station:
        raise ValueError("Approved crate frequency and Tower frequency differ.")
    ids, entries = prog.get("track_ids"), crate.get("tracks")
    if (not isinstance(ids, list) or not isinstance(entries, list)
            or not 1 <= len(ids) == len(entries) <= 250):
        raise ValueError("A handoff needs 1–250 ordered crate entries.")
    for id_, entry in zip(ids, entries):
        if (not isinstance(id_, str) or not TRACK.fullmatch(id_)
                or not isinstance(entry, dict) or entry.get("id") != id_):
            raise ValueError("Cloud handoff lost its saved running order.")
        local = isinstance(entry.get("path"), str) and bool(entry.get("path"))
        remote = isinstance(entry.get("url"), str) and bool(entry.get("url"))
        if local == remote:
            raise ValueError("Each cloud recording needs exactly one local or remote source.")
        if remote:
            published_audio_url(entry["url"], entry.get("source_kind"))
        elif "url" in entry or "source_kind" in entry:
            raise ValueError("Local cloud entries cannot smuggle remote source details.")
        expected = entry.get("expected_sha")
        if expected is not None:
            if not isinstance(expected, str) or not re.fullmatch("[0-9a-f]{64}", expected):
                raise ValueError("Invalid source digest in handoff.")
            if UPLOAD.fullmatch(id_) and expected != id_[7:]:
                raise ValueError("Imported audio identity differs from source digest.")
        if UPLOAD.fullmatch(id_) and expected is None:
            raise ValueError("Imported recording lacks source digest.")
    if packet.get("fingerprint") != _fingerprint(packet):
        raise ValueError("Handoff changed after export. Export it again from Tower.")
    return station, requested


def validate_prepared(handoff, tracks):
    """Verify that the decoded local media exactly matches the exported show."""
    validate_handoff(handoff)
    if not isinstance(tracks, list) or len(tracks) != len(handoff["program"]["track_ids"]):
        raise ValueError("Prepared media count differs from saved program.")
    total = 0
    for file_track, ref, prepared in zip(handoff["crate"]["tracks"],
                                         handoff["program"]["track_ids"], tracks):
        if not isinstance(prepared, dict) or prepared.get("id") != ref:
            raise ValueError("Prepared media order differs from saved program.")
        if file_track.get("expected_sha") and prepared.get("asset_sha") != file_track["expected_sha"]:
            raise ValueError("Source audio changed since Tower export.")
        durations = prepared.get("durations_ms")
        if not isinstance(durations, list) or not durations or any(type(n) is not int or n <= 0 for n in durations):
            raise ValueError("Every scheduled track needs valid AAC durations.")
        total += sum(durations)
    if not 0 < total <= MAX_DURATION_MS:
        raise ValueError("Cloud program duration must be under eight hours.")
    return total


def schedule_curated(existing, frequency, tracks, handoff, now=None):
    """Schedule exact running order and return to previous house program."""
    from autopilot_publisher import SCHEMA as CLOUD_SCHEMA, next_boundary, clock_ms, iso
    station, requested = validate_handoff(handoff)
    if station != frequency:
        raise ValueError("Cloud handoff cannot authorize another frequency.")
    current = now or datetime.now(UTC)
    if requested <= current + timedelta(minutes=3):
        raise ValueError("Schedule the cloud program at least three minutes ahead.")
    if not isinstance(existing, dict) or existing.get("schema") != CLOUD_SCHEMA or existing.get("station_id") != frequency:
        raise ValueError("Seed and verify a house Cloud Autopilot schedule before booking a show.")
    revisions = existing.get("revisions")
    if not isinstance(revisions, list) or not 1 <= len(revisions) <= 30:
        raise ValueError("Cloud revision history cannot fit a show and return.")
    total = validate_prepared(handoff, tracks)
    previous = revisions[-1]
    target_ms = round(requested.timestamp() * 1000)
    if target_ms <= clock_ms(previous["effective_at"]):
        raise ValueError("The show overlaps an existing future cloud revision.")
    start_ms = next_boundary(previous, target_ms)
    started = datetime.fromtimestamp(start_ms / 1000, tz=UTC)
    ended = datetime.fromtimestamp((start_ms + total) / 1000, tz=UTC)
    digest = sha256((handoff["fingerprint"] + iso(started)).encode()).hexdigest()[:22]
    guest = {"id": "g-" + digest, "effective_at": iso(started), "tracks": tracks}
    restore = {"id": "r-" + digest + "-return", "effective_at": iso(ended),
               "tracks": previous["tracks"]}
    return {"schema": CLOUD_SCHEMA, "station_id": frequency,
            "revisions": revisions + [guest, restore]}
