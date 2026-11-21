"""TOWER 011 — deterministic rolling-window planning, NOT a live publisher.

The full source-approved radio cycle stays the owner's canonical editorial
schedule. A future continuity-safe scheduler may publish successive bounded
windows. Until Cloud HOUSE can preserve HLS media sequence across historical
revision pruning, this module is read-only to production.
"""
from house_rotation import fingerprint

SCHEMA = "humkin.tower.rolling-plan/v1"
MIN_HORIZON = 60 * 60
MAX_HORIZON = 6 * 60 * 60


def plan_window(full_selection, *, previous=None, hours=3):
    if not isinstance(full_selection, dict) or full_selection.get("mode") != "full_catalog":
        raise ValueError("Rolling planner accepts only an approved FULL HOUSE candidate.")
    if full_selection.get("state") != "draft_for_owner_review":
        raise ValueError("An unauthorized playlist cannot create a rolling window.")
    if full_selection.get("fingerprint") != fingerprint(full_selection):
        raise ValueError("Source-owned playlist fingerprint changed: HOLD.")
    if type(hours) not in (int, float) or not 1 <= hours <= 6:
        raise ValueError("Rolling horizon must be between one and six hours.")
    songs = full_selection.get("tracks")
    if not isinstance(songs, list) or not 2 <= len(songs) <= 500:
        raise ValueError("Invalid bounded approved source cycle.")
    for row in songs:
        duration = row.get("duration_seconds") if isinstance(row, dict) else None
        if type(duration) not in (int, float) or not 0 < duration <= 1800:
            raise ValueError("A rolling candidate has an invalid source duration.")
    source = full_selection["fingerprint"]
    ticks = 0
    if previous is not None:
        if (not isinstance(previous, dict) or previous.get("schema") != SCHEMA
                or previous.get("source_fingerprint") != source or
                type(previous.get("next_cursor")) is not int
                or previous["next_cursor"] < 0):
            raise ValueError("Rolling history changed source policy; operator review required.")
        ticks = previous["next_cursor"]
    limit = int(hours * 3600)
    cursor, items, running = ticks, [], 0.0
    unique_music = set()
    # Never republish an entire 15-hour rotation simply to cover three hours.
    # Still permit one source cycle per window and preserve the canonical
    # ordering (no single-item randomization at a transition).
    while len(items) < len(songs) and (running < limit or len(unique_music) < 2):
        row = songs[cursor % len(songs)]
        items.append(row)
        running += row["duration_seconds"]
        if "kind" not in row or row["kind"] == "song":
            unique_music.add(row["id"])
        cursor += 1
    if len(unique_music) < 2 or running < MIN_HORIZON:
        raise ValueError("The approved cycle cannot cover a safe rolling horizon.")
    return {
        "schema": SCHEMA, "source_fingerprint": source,
        "station_id": full_selection["station_id"],
        "start_cursor": ticks, "next_cursor": cursor,
        "duration_seconds": round(running, 3),
        "target_seconds": limit,
        "entries": items,
        # A preview is not a Cloud HOUSE publication or a next-on-air claim.
        "state": "preview_only_requires_continuity_engine",
    }
