"""TOWER 010: durable, owner-issued cloud scheduling intents.

Only the existing Supabase RLS table can admit commands. The public projection
contains solely command number, action, catalog UUID, and timestamp. A request
is NOT accepted/on-air until the cloud program pointer is committed.

The Cloud HOUSE encoder is still source-owned; queue/weight/hold changes
recalculate the playlist but NEVER modify existing audio bytes.
"""
from collections import Counter
import json
import random
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from house_rotation import (API, PUBLIC_KEY, UUID, FULL, fingerprint,
                            public_bumper_settings, local_bumper_policy,
                            digest_config)
from scheduler_v2 import add_bonus_slots, with_bumpers

SCHEMA = "humkin.tower.living-control/v1"
ACTIONS = {"queue_next", "queue_end", "hold", "release", "more", "less", "metadata_refresh"}
MAX_PENDING = 50
MAX_WEIGHT = 2


def public_intents(after_id=0, *, opener=urlopen):
    """Read at most fifty freshly issued commands; fail on overflow."""
    if type(after_id) is not int or after_id < 0:
        raise ValueError("Invalid cloud control cursor.")
    query = urlencode({
        "select": "id,track_id,action,requested_at",
        "id": f"gt.{after_id}", "order": "id.asc",
        "limit": str(MAX_PENDING + 1),
    })
    request = Request(API + "/rest/v1/humkin_tower_control_intents?" + query,
                      headers={"apikey": PUBLIC_KEY, "Accept": "application/json",
                               "Accept-Encoding": "identity",
                               "User-Agent": "HUMKIN-Living-Control/1.0"})
    with opener(request, timeout=20) as response:
        if getattr(response, "status", 200) != 200:
            raise ValueError("Control request ledger unavailable: HOLD.")
        body = response.read(55_001)
    if len(body) > 55_000:
        raise ValueError("Control ledger response too large: HOLD.")
    result = json.loads(body)
    if not isinstance(result, list) or len(result) > MAX_PENDING:
        raise ValueError("Too many pending controls; HOLD for an operator review.")
    return result


def state_from_cloud(existing):
    """Published output, not a browser local variable, is the state checkpoint."""
    if not existing:
        return {"schema": SCHEMA, "cursor": 0, "holds": [], "weights": {}}
    recent = existing["revisions"][-1].get("control")
    if recent is None:
        # Prior TOWER 007–009 programs have no control state.
        return {"schema": SCHEMA, "cursor": 0, "holds": [], "weights": {}}
    if not isinstance(recent, dict) or recent.get("schema") != SCHEMA:
        raise ValueError("Unsupported published Cloud HOUSE control state.")
    cursor, holds, weights = (recent.get(k) for k in ("cursor", "holds", "weights"))
    if type(cursor) is not int or cursor < 0:
        raise ValueError("Invalid cloud control cursor.")
    if (not isinstance(holds, list) or len(holds) > 500 or
            any(not isinstance(x, str) or not UUID.fullmatch(x) for x in holds)
            or len(set(holds)) != len(holds)):
        raise ValueError("Invalid published hold set.")
    if (not isinstance(weights, dict) or len(weights) > 500 or
            any(not isinstance(uid, str) or not UUID.fullmatch(uid) or
                type(delta) is not int or not -MAX_WEIGHT <= delta <= MAX_WEIGHT
                for uid, delta in weights.items())):
        raise ValueError("Invalid published weight policy.")
    return {"schema": SCHEMA, "cursor": cursor,
            "holds": sorted(holds), "weights": dict(sorted(weights.items()))}


def compile_controls(base, live_rows, previous, commands, *, settings=None, bumper_policy=None):
    """Return a new selection and an R2 revision control receipt.

    The incoming FULL selection has already passed its own catalog+policy
    validation. Every intent must still name a *currently eligible* source.
    This function neither writes database state nor Cloudflare objects.
    """
    if base.get("mode") != "full_catalog" or base.get("station_id") != "station-one":
        raise ValueError("Only the validated FULL Cloud HOUSE can take live controls.")
    checkpoint = state_from_cloud({"revisions": [{"control": previous}]}) if previous else state_from_cloud(None)
    cursor = checkpoint["cursor"]
    rows = {r["id"]: r for r in live_rows if isinstance(r, dict)
            and isinstance(r.get("id"), str)}
    approved = {r["id"]: r for r in live_rows if isinstance(r, dict)
                and isinstance(r.get("id"), str)
                and r.get("enabled") is True and r.get("published_at") is not None
                and r.get("storage_provider") == "r2"
                and r.get("kind") in ("song", "bumper")}
    holds = set(checkpoint["holds"])
    weights = dict(checkpoint["weights"])
    queue_next, queue_end = [], []
    last_id = cursor
    changes = []
    for command in commands:
        if not isinstance(command, dict):
            raise ValueError("Invalid command record.")
        seq, ident, action = (command.get(k) for k in ("id", "track_id", "action"))
        if (type(seq) is not int or seq <= last_id or
                not isinstance(ident, str) or not UUID.fullmatch(ident) or
                action not in ACTIONS):
            raise ValueError("Out-of-order or malformed owner command: HOLD.")
        last_id = seq
        source = approved.get(ident)
        if source is None or source.get("r2_object_key") != (
            f"tracks/{ident}/{source.get('sha256')}.mp3"):
            raise ValueError("A requested track was revoked or changed: HOLD.")
        if action in ("more", "less") and source.get("kind") != "song":
            raise ValueError("Bumper rotation weights cannot be edited.")
        if action == "hold":
            holds.add(ident)
        elif action == "release":
            holds.discard(ident)
        elif action in ("more", "less"):
            next_weight = weights.get(ident, 0) + (1 if action == "more" else -1)
            if not -MAX_WEIGHT <= next_weight <= MAX_WEIGHT:
                raise ValueError("Rotation weight already at its limit; HOLD.")
            if next_weight:
                weights[ident] = next_weight
            else:
                weights.pop(ident, None)
        elif action in ("queue_next", "queue_end"):
            (queue_next if action == "queue_next" else queue_end).append(ident)
        changes.append({"id": seq, "track_id": ident, "action": action})
    state = {"schema": SCHEMA, "cursor": last_id, "holds": sorted(holds),
             "weights": dict(sorted(weights.items()))}
    if changes:
        state["last_action"] = changes[-1]
        state["applied_count"] = len(changes)
    else:
        if previous and previous.get("last_action"):
            state["last_action"] = previous["last_action"]
    if not holds and not weights and not queue_next and not queue_end:
        # Keep exactly the canonical baseline, including its original Bumper
        # Brain random seed and all release/seasonal weights.
        selected = dict(base)
        selected["control"] = state
        selected["fingerprint"] = fingerprint(selected)
        return selected, state

    sources = {x["id"]: x for x in base["tracks"]}
    # The implicit rotation comprises eligible Bumper Brain carts and songs;
    # intentional one-shot queues can contain approved feature-only carts.
    for row in approved.values():
        if row["id"] not in sources and row["kind"] == "bumper":
            seconds = row.get("duration_seconds")
            if type(seconds) in (int, float) and 0 < seconds <= 180:
                from house_rotation import accepted_row
                explicit = accepted_row(row, kind="bumper")
                if explicit is not None:
                    sources[row["id"]] = explicit
    counts = Counter(x["id"] for x in base["tracks"] if x.get("kind") == "song")
    music = [x["id"] for x in base["tracks"]
             if x.get("kind") == "song" and x["id"] not in holds]
    if len(set(music)) < 2:
        raise ValueError("Holds leave fewer than two playable songs: HOLD.")
    # Reduce positions from the back; never delete the last base appearance.
    for uid, delta in weights.items():
        if uid in holds or uid not in counts:
            continue
        target = max(1, min(5, counts[uid] + delta))
        amount = max(0, music.count(uid) - target)
        while amount:
            music.pop(len(music) - 1 - music[::-1].index(uid))
            amount -= 1
    extras = []
    for uid, delta in weights.items():
        if uid in holds or uid not in counts:
            continue
        target = max(1, min(5, counts[uid] + delta))
        extras.extend([uid] * max(0, target - music.count(uid)))
    seed = int(digest_config({"seed": base["fingerprint"],
                              "holds": sorted(holds),
                              "weights": state["weights"]})[:16], 16)
    music = add_bonus_slots(music, extras, random.Random(seed))
    # Feature-only carts may be QUEUED explicitly, but MUST NOT enter
    # incidental Bumper Brain via the by_id source pool.
    base_sources = {item["id"] for item in base["tracks"]}
    by_id = {uid: {
        "id": uid, "kind": item.get("kind", "song"),
        "duration": item["duration_seconds"], "sha256": item["sha256"],
    } for uid, item in sources.items()
       if uid in base_sources and uid not in holds}
    effective_settings = settings if settings is not None else public_bumper_settings()
    effective_policy = bumper_policy if bumper_policy is not None else local_bumper_policy()
    # Source-owned three-lane Bumper Brain still owns incidental breaks.
    incidental = with_bumpers(music, by_id, effective_settings,
                              effective_policy, random.Random(seed ^ 0x71BDEA))
    for uid in queue_next + queue_end:
        if uid not in sources or uid in holds:
            raise ValueError("Cannot queue a held or unavailable recording.")
    ordered = queue_next + incidental + queue_end
    if len(ordered) > 500:
        raise ValueError("Controlled HOUSE exceeds 500 entries: HOLD.")
    result = dict(base)
    result["tracks"] = [sources[uid] for uid in ordered]
    result["weighted_song_slots"] = len(music)
    result["bumper_break_count"] = sum(x.get("kind") == "bumper" for x in result["tracks"])
    result["control"] = state
    result["fingerprint"] = fingerprint(result)
    return result, state
