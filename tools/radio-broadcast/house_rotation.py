"""Source-verified HOUSE rotation from already published HUMKIN R2 songs.

A selection is an owner-reviewable DRAFT, never a broadcast authorization.
The publisher rechecks source approval and byte identity before publication.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from catalog_sources import r2_public_url

SCHEMA = "humkin.cloud-house-selection/v1"
CRATE_SCHEMA = "humkin.autopilot.crate/v1"
API = "https://kbhqacsdvjsstzyplqij.supabase.co"
# Public, read-only publishable key already used in the HUMKIN Long Wave Worker.
PUBLIC_KEY = "sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o"
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
SHA = re.compile(r"^[0-9a-f]{64}$")
STATION = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")
SOURCE = "approved-public-r2-catalog"
MAX_ROWS = 500
MAX_BYTES = 1_500_000


def catalog_rows(opener=urlopen):
    """Read only published, enabled song rows. Never use a service-role key."""
    query = urlencode({
        "select": "id,title,artist,album,duration_seconds,sha256,r2_object_key,kind,enabled,published_at,storage_provider",
        "enabled": "eq.true", "published_at": "not.is.null",
        "storage_provider": "eq.r2", "kind": "eq.song", "limit": str(MAX_ROWS),
    })
    req = Request(API + "/rest/v1/humkin_radio_tracks?" + query, headers={
        "apikey": PUBLIC_KEY, "Accept": "application/json",
        "Accept-Encoding": "identity", "User-Agent": "HUMKIN-House-Selection/1.0",
    })
    with opener(req, timeout=20) as response:
        if getattr(response, "status", 200) != 200:
            raise ValueError("Public catalog is unavailable; no new house selection.")
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("Public catalog response exceeds its safety limit.")
    rows = json.loads(data)
    if not isinstance(rows, list) or len(rows) > MAX_ROWS:
        raise ValueError("Invalid approved public catalog.")
    return rows


def accepted_row(row):
    """A published row maps to exactly one content-addressed public MP3."""
    if not isinstance(row, dict) or row.get("enabled") is not True:
        return None
    if row.get("published_at") is None or row.get("kind") != "song":
        return None
    if row.get("storage_provider") != "r2":
        return None
    uid, sha, key = row.get("id"), row.get("sha256"), row.get("r2_object_key")
    if not isinstance(uid, str) or not UUID.fullmatch(uid):
        return None
    if not isinstance(sha, str) or not SHA.fullmatch(sha):
        return None
    if key != f"tracks/{uid}/{sha}.mp3" or r2_public_url(key) is None:
        return None
    name = row.get("title")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 160:
        return None
    duration = row.get("duration_seconds")
    if type(duration) not in (float, int) or not 30 <= duration <= 1800:
        return None
    artist = row.get("artist") or "HUMKIN"
    album = row.get("album") or ""
    if not isinstance(artist, str) or not isinstance(album, str):
        return None
    return {
        "id": uid, "sha256": sha, "r2_object_key": key,
        "title": name.strip(), "artist": artist.strip()[:160],
        "album": album.strip()[:160],
        "duration_seconds": round(duration, 3),
    }


def fingerprint(packet):
    data = {k: v for k, v in packet.items() if k != "fingerprint"}
    return hashlib.sha256(json.dumps(
        data, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")).hexdigest()


def make_selection(rows, *, station="station-one", count=40):
    if not STATION.fullmatch(station):
        raise ValueError("Invalid cloud station.")
    if type(count) is not int or not 2 <= count <= 40:
        raise ValueError("Choose between 2 and 40 house recordings.")
    candidates = {}
    for row in rows:
        selected = accepted_row(row)
        if selected:
            candidates[selected["id"]] = selected
    if len(candidates) < count:
        raise ValueError("Not enough approved, content-addressed songs for this house.")
    # Deterministic, catalog-proportional artist allocation. The previous
    # largest-bin alternator could omit a smaller approved artist entirely.
    # No play counts or undisclosed editorial weights are inferred.
    bins = {}
    for item in candidates.values():
        bins.setdefault(item["artist"].casefold(), []).append(item)
    for values in bins.values():
        values.sort(key=lambda entry: hashlib.sha256(
            ("HUMKIN-NIGHT-SHIFT-003:" + entry["id"]).encode()).hexdigest())
    weights = {name: len(items) for name, items in bins.items()}
    total = sum(weights.values())
    chosen_counts = {name: 0 for name in bins}
    ordered = []
    previous = None
    for slot in range(count):
        available = [name for name, items in bins.items() if items]
        if not available:
            break
        alternatives = [name for name in available if name != previous]
        if alternatives:
            available = alternatives
        # Weighted fair scheduling: minimize catalog-proportional deficit.
        # Integer arithmetic keeps output stable across runtimes and platforms.
        chosen_name = min(available, key=lambda name: (
            chosen_counts[name] * total - (slot + 1) * weights[name],
            -weights[name], name))
        ordered.append(bins[chosen_name].pop(0))
        chosen_counts[chosen_name] += 1
        previous = chosen_name
    packet = {
        "schema": SCHEMA, "state": "draft_for_owner_review",
        "station_id": station, "source": SOURCE, "tracks": ordered,
    }
    packet["fingerprint"] = fingerprint(packet)
    return packet


def validate_selection(packet, rows):
    if not isinstance(packet, dict) or packet.get("schema") != SCHEMA:
        raise ValueError("Not a HUMKIN house selection.")
    if packet.get("state") != "draft_for_owner_review" or packet.get("source") != SOURCE:
        raise ValueError("House selection must remain an owner-review draft.")
    if (not isinstance(packet.get("station_id"), str)
            or not STATION.fullmatch(packet["station_id"])):
        raise ValueError("Invalid house station.")
    songs = packet.get("tracks")
    if not isinstance(songs, list) or not 2 <= len(songs) <= 40:
        raise ValueError("A house selection needs 2–40 reviewed songs.")
    if packet.get("fingerprint") != fingerprint(packet):
        raise ValueError("House selection changed; generate and review again.")
    current = {}
    for row in rows:
        item = accepted_row(row)
        if item:
            current[item["id"]] = item
    seen = set()
    for item in songs:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            raise ValueError("Invalid house recording.")
        ident = item["id"]
        if ident in seen:
            raise ValueError("Duplicate house recording; keep one slot per song.")
        seen.add(ident)
        if item != current.get(ident):
            raise ValueError("Published radio eligibility or source metadata changed; regenerate selection.")
    return packet["station_id"]


def crate_from_selection(packet):
    """Internal publisher mapping after validate_selection against LIVE rows."""
    return {
        "schema": CRATE_SCHEMA, "station_id": packet["station_id"],
        "tracks": [{
            "id": "r2-" + row["id"], "title": row["title"],
            "artist": row["artist"], "album": row["album"],
            "source_kind": "r2", "url": r2_public_url(row["r2_object_key"]),
            "expected_sha": row["sha256"],
        } for row in packet["tracks"]],
    }


def main():
    parser = argparse.ArgumentParser(description="Draft a bounded, approved R2 HOUSE playlist.")
    parser.add_argument("--count", type=int, default=40)
    parser.add_argument("--station", default="station-one")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    packet = make_selection(catalog_rows(), station=args.station, count=args.count)
    # A draft can be shared with the owner; it contains no credentials.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Wrote HOUSE DRAFT:", args.output)
    print("Tracks:", len(packet["tracks"]))
    print("Estimated minutes:", round(sum(t["duration_seconds"] for t in packet["tracks"]) / 60, 1))
    print("REVIEW REQUIRED: no audio uploaded, no cloud program modified.")


if __name__ == "__main__":
    main()
