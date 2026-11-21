"""Source-verified HOUSE rotation from already published HUMKIN R2 songs.

A selection is an owner-reviewable DRAFT, never a broadcast authorization.
The publisher rechecks source approval and byte identity before publication.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import random
from scheduler_v2 import with_bumpers, bumper_lane, allowed_bumper
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
FULL_SOURCE = "approved-public-r2-catalog+bumper-brain/v1"
FULL = "FULL"
MAX_ROWS = 500
MAX_BYTES = 1_500_000


def catalog_rows(opener=urlopen):
    """Read only published, enabled song rows. Never use a service-role key."""
    query = urlencode({
        "select": "id,title,artist,album,duration_seconds,sha256,r2_object_key,kind,enabled,published_at,storage_provider",
        "enabled": "eq.true", "published_at": "not.is.null",
        "storage_provider": "eq.r2", "limit": str(MAX_ROWS),
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


def public_bumper_settings(opener=urlopen):
    """Read only the owner's published bumper cadence, holds and relation rules."""
    query = urlencode({"select": "bumper_every,bumper_groups,bumper_rules",
                       "id": "eq.main", "limit": "1"})
    req = Request(API + "/rest/v1/humkin_radio_settings?" + query, headers={
        "apikey": PUBLIC_KEY, "Accept": "application/json",
        "Accept-Encoding": "identity", "User-Agent": "HUMKIN-Full-House/1.0"})
    with opener(req, timeout=20) as response:
        if getattr(response, "status", 200) != 200:
            raise ValueError("Public bumper settings unavailable; HOLD.")
        raw = response.read(100_001)
    if len(raw) > 100_000:
        raise ValueError("Bumper settings too large; HOLD.")
    data = json.loads(raw)
    if not isinstance(data, list) or len(data) != 1:
        raise ValueError("Expected exactly one live station settings row.")
    row = data[0]
    frequency = row.get("bumper_every")
    groups = row.get("bumper_groups") or []
    rules = row.get("bumper_rules") or []
    if type(frequency) is not int or not 1 <= frequency <= 20 or not isinstance(groups, list) or not isinstance(rules, list):
        raise ValueError("Invalid or disabled live bumper policy; HOLD.")
    return {"bumper_every": frequency, "bumper_groups": groups, "bumper_rules": rules}


def local_bumper_policy():
    """Use the repo-owned policy, not a competing cloud scheduling definition."""
    path = Path(__file__).resolve().parents[2] / "fm" / "rotation.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    policy = dict(manifest.get("bumper_brain") or {})
    policy["feature_only_spoken_sha256s"] = manifest.get("feature_only_spoken_sha256s") or []
    return policy


def digest_config(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                        separators=(",", ":")).encode("utf-8")).hexdigest()


def accepted_row(row, *, kind="song", min_song_seconds=30):
    """A published row maps to exactly one content-addressed public MP3."""
    if not isinstance(row, dict) or row.get("enabled") is not True:
        return None
    if row.get("published_at") is None or row.get("kind") != kind:
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
    if type(duration) not in (float, int) or not (min_song_seconds <= duration <= 1800 if kind == "song" else 0 < duration <= 180):
        return None
    artist = row.get("artist") or "HUMKIN"
    album = row.get("album") or ""
    if not isinstance(artist, str) or not isinstance(album, str):
        return None
    result = {
        "id": uid, "sha256": sha, "r2_object_key": key,
        "title": name.strip(), "artist": artist.strip()[:160],
        "album": album.strip()[:160],
        "duration_seconds": round(duration, 3),
    }
    if kind == "bumper" or min_song_seconds != 30:
        result["kind"] = kind
    return result


def fingerprint(packet):
    data = {k: v for k, v in packet.items() if k != "fingerprint"}
    return hashlib.sha256(json.dumps(
        data, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")).hexdigest()


def make_selection(rows, *, station="station-one", count=40, bumper_settings=None, bumper_policy=None):
    if not STATION.fullmatch(station):
        raise ValueError("Invalid cloud station.")
    full = count == FULL
    if not full and (type(count) is not int or not 2 <= count <= 40):
        raise ValueError("Choose 2–40 songs or the explicitly reviewed FULL catalog.")
    candidates = {}
    for row in rows:
        selected = accepted_row(row, min_song_seconds=15 if full else 30)
        if selected:
            candidates[selected["id"]] = selected
    if full:
        # FULL must account for every enabled, published R2 song, not silently
        # discard a song whose title, duration or content identity changed.
        source_songs = sum(row.get("kind") == "song" for row in rows if isinstance(row, dict))
        if source_songs != len(candidates) or not 2 <= len(candidates) <= MAX_ROWS:
            raise ValueError("Some enabled catalog songs fail strict source validation; HOLD FULL.")
        count = len(candidates)
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
    if full:
        settings = public_bumper_settings() if bumper_settings is None else bumper_settings
        policy = local_bumper_policy() if bumper_policy is None else bumper_policy
        if not isinstance(settings, dict) or type(settings.get("bumper_every")) is not int or not 1 <= settings["bumper_every"] <= 20:
            raise ValueError("FULL requires a valid, enabled owner bumper cadence.")
        if not isinstance(settings.get("bumper_groups", []), list) or not isinstance(settings.get("bumper_rules", []), list):
            raise ValueError("Invalid live bumper relations or rules.")
        if not isinstance(policy, dict):
            raise ValueError("Invalid source-owned Bumper Brain policy.")
        eligible_carts = {}
        all_carts = [row for row in rows if isinstance(row, dict) and row.get("kind") == "bumper"]
        feature_only = set(policy.get("feature_only_spoken_sha256s") or [])
        for row in all_carts:
            cart = accepted_row(row, kind="bumper")
            if cart is None:
                # >180-second announcements require a deliberate show slot.
                # Every other malformed enabled cart must stop this release.
                if type(row.get("duration_seconds")) in (int, float) and row["duration_seconds"] > 180:
                    continue
                raise ValueError("An enabled bumper failed media validation; HOLD FULL.")
            if cart["sha256"] in feature_only:
                continue
            track = {"id": cart["id"], "kind": "bumper",
                     "duration": cart["duration_seconds"], "sha256": cart["sha256"]}
            if bumper_lane(track, policy) is None:
                continue
            if not allowed_bumper(cart["id"], settings.get("bumper_rules", []), clock=True):
                continue
            eligible_carts[cart["id"]] = cart
        for rule in settings.get("bumper_rules", []):
            if rule.get("enabled") is True and rule.get("kind") in ("daypart", "date"):
                if any(i in eligible_carts for i in rule.get("track_ids", [])):
                    raise ValueError("Time-limited bumper cannot be honored by a fixed full-cloud rotation; HOLD.")
        by_id = {entry["id"]: {"id": entry["id"], "kind": "song",
                 "duration": entry["duration_seconds"], "sha256": entry["sha256"]}
                 for entry in ordered}
        by_id.update({uid: {"id": uid, "kind": "bumper",
                 "duration": entry["duration_seconds"], "sha256": entry["sha256"]}
                 for uid, entry in eligible_carts.items()})
        ordered_ids = with_bumpers([entry["id"] for entry in ordered], by_id,
                                    settings, policy,
                                    random.Random(int(digest_config(sorted(by_id))[:16], 16)))
        if len(ordered_ids) > 500:
            raise ValueError("FULL exceeds Cloud Autopilot's 500-entry program limit; HOLD.")
        source_by_id = {**candidates, **eligible_carts}
        planned = [source_by_id[uid] for uid in ordered_ids]
        packet = {
            "schema": SCHEMA, "state": "draft_for_owner_review",
            "station_id": station, "source": FULL_SOURCE, "mode": "full_catalog",
            "song_count": len(ordered),
            "bumper_break_count": len(planned) - len(ordered),
            "eligible_bumper_count": len(eligible_carts),
            "held_bumper_count": len(all_carts) - len(eligible_carts),
            "bumper_configuration_digest": digest_config({"settings": settings, "policy": policy}),
            "tracks": planned,
        }
    else:
        packet = {
            "schema": SCHEMA, "state": "draft_for_owner_review",
            "station_id": station, "source": SOURCE, "tracks": ordered,
        }
    packet["fingerprint"] = fingerprint(packet)
    return packet


def validate_selection(packet, rows, *, bumper_settings=None, bumper_policy=None):
    if not isinstance(packet, dict) or packet.get("schema") != SCHEMA:
        raise ValueError("Not a HUMKIN house selection.")
    if packet.get("state") != "draft_for_owner_review" or packet.get("source") not in (SOURCE, FULL_SOURCE):
        raise ValueError("House selection must remain an owner-review draft.")
    if (not isinstance(packet.get("station_id"), str)
            or not STATION.fullmatch(packet["station_id"])):
        raise ValueError("Invalid house station.")
    songs = packet.get("tracks")
    full = packet.get("mode") == "full_catalog" and packet.get("source") == FULL_SOURCE
    if not isinstance(songs, list) or not 2 <= len(songs) <= (500 if full else 40):
        raise ValueError("Invalid reviewed cloud program size.")
    if packet.get("fingerprint") != fingerprint(packet):
        raise ValueError("House selection changed; generate and review again.")
    if full:
        settings = public_bumper_settings() if bumper_settings is None else bumper_settings
        policy = local_bumper_policy() if bumper_policy is None else bumper_policy
        expected = make_selection(rows, station=packet["station_id"], count=FULL,
                                  bumper_settings=settings, bumper_policy=policy)
        if packet != expected:
            raise ValueError("FULL source eligibility, bumper policy or reviewed running order changed; regenerate selection.")
        return packet["station_id"]
    if packet.get("mode") is not None or packet.get("source") != SOURCE:
        raise ValueError("Unsupported house draft mode.")
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
    parser.add_argument("--count", default="40", help="2–40 songs, or FULL for all approved songs plus incidental bumpers")
    parser.add_argument("--station", default="station-one")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    count = FULL if args.count.upper() == FULL else int(args.count)
    packet = make_selection(catalog_rows(), station=args.station, count=count)
    # A draft can be shared with the owner; it contains no credentials.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Wrote HOUSE DRAFT:", args.output)
    print("Program entries:", len(packet["tracks"]))
    if packet.get("mode") == "full_catalog":
        print("Unique songs:", packet["song_count"], "Bumper breaks:", packet["bumper_break_count"],
              "Held/feature-only bumpers:", packet["held_bumper_count"])
    print("Estimated minutes:", round(sum(t["duration_seconds"] for t in packet["tracks"]) / 60, 1))
    print("REVIEW REQUIRED: no audio uploaded, no cloud program modified.")


if __name__ == "__main__":
    main()
