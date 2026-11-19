"""Bounded, owner-controlled batch edits and reusable program drafts for HUMKIN Tower.

No background publication: edits are local to one frequency. A program is an
ordered reference list, not a copy of audio and not a Cloud Autopilot approval.
"""
import secrets
import time

from now_playing import artwork_url

MAX_BATCH = 250
MAX_PROGRAMS = 100
MAX_QUEUE = 4000
METADATA_LIMITS = {"artist": 160, "album": 180, "genre": 100,
                   "tags": 400, "notes": 1000, "artwork": 512}
POLICY_ACTIONS = {"hold", "release", "disable", "enable", "more", "less"}
QUEUE_ACTIONS = {"queue_next", "queue_end"}
LINEUP_ACTIONS = {"lineup_add", "lineup_remove"}


def checked_ids(desk, raw, *, allow_repeats=False):
    if (not isinstance(raw, list) or not 1 <= len(raw) <= MAX_BATCH
            or any(not isinstance(id_, str) or not id_ for id_ in raw)):
        raise ValueError("Choose 1–250 recordings.")
    if not allow_repeats and len(set(raw)) != len(raw):
        raise ValueError("Select each recording only once.")
    if desk.tower:
        desk.tower.find_tracks(desk.station.by_id)
    if any(id_ not in desk.station.by_id for id_ in raw):
        raise ValueError("One or more recordings are no longer in this frequency's crate.")
    return raw[:]


def apply_batch(desk, request):
    """All-or-nothing local batch. Caller holds Desk's RLock."""
    operation = request.get("operation")
    ids = checked_ids(desk, request.get("ids"))
    state = desk.state
    if operation in POLICY_ACTIONS:
        now = time.time()
        policies = {id_: dict(value) for id_, value in state["tracks"].items()}
        before = {id_: dict(policies.get(id_, {})) for id_ in ids}
        for id_ in ids:
            value = policies.setdefault(id_, {})
            if operation == "hold":
                value["hold_until"] = now + 3600
            elif operation == "release":
                value["hold_until"] = 0
            elif operation in ("disable", "enable"):
                value["disabled"] = operation == "disable"
            else:
                if id_ not in desk.station.songs:
                    raise ValueError("Rotation weights apply only to rotating recordings.")
                weight = value.get("weight", 0) + (1 if operation == "more" else -1)
                if not -2 <= weight <= 2:
                    raise ValueError("A selected rotation weight is already at its limit.")
                value["weight"] = weight
        if not any(id_ not in desk.failed and not policies.get(id_, {}).get("disabled")
                   and policies.get(id_, {}).get("hold_until", 0) <= now
                   for id_ in desk.station.songs):
            raise ValueError("At least one playable song must stay in rotation.")
        label = operation.replace("_", " ").title() + f" ({len(ids)} tracks)"
        history = state["history"][:] + [{
            "label": label, "batch_before": before, "at": time.time_ns()
        }]
        desk.save(state | {"tracks": policies, "history": history[-30:]})
    elif operation in QUEUE_ACTIONS:
        if any(not desk.eligible(id_) for id_ in ids):
            raise ValueError("A selected recording is held, disabled or unavailable.")
        lineup = state["lineup"][:]
        if len(lineup) + len(ids) > MAX_QUEUE:
            raise ValueError("The queue would exceed 4,000 recordings.")
        lineup = ids + lineup if operation == "queue_next" else lineup + ids
        desk.save(state | {"lineup": lineup})
    elif operation in LINEUP_ACTIONS:
        if not desk.can_curate:
            raise ValueError("Choose a secondary frequency for a curated lineup.")
        lineup = state.get("curated_lineup", [])[:]
        if operation == "lineup_add":
            for id_ in ids:
                if id_ not in lineup:
                    lineup.append(id_)
        else:
            lineup = [id_ for id_ in lineup if id_ not in ids]
        if desk.curated and not any(id_ in desk.station.by_id and desk.eligible(id_)
                                    for id_ in lineup):
            raise ValueError("Keep at least one playable recording in the curated lineup.")
        desk.save(state | {"curated_lineup": lineup})
        if desk.curated:
            desk.apply_rotation()
    elif operation == "rotation_add":
        if desk.curated:
            raise ValueError("Switch to standard rotation before adding uploaded tracks.")
        if any(desk.station.by_id[id_].get("source") != "upload" for id_ in ids):
            raise ValueError("Only uploaded recordings can join standard rotation here.")
        uploads = set(state.get("rotation_uploads", []))
        uploads.update(ids)
        desk.save(state | {"rotation_uploads": sorted(uploads)})
        for id_ in ids:
            if id_ not in desk.station.songs:
                desk.station.songs.append(id_)
    elif operation == "metadata":
        field = request.get("field")
        value = request.get("value")
        if field not in METADATA_LIMITS or not isinstance(value, str) or len(value) > METADATA_LIMITS[field]:
            raise ValueError("Choose a supported metadata field and a valid value.")
        value = value.strip()
        if field == "artwork" and value and artwork_url(value) != value:
            raise ValueError("Artwork must use an approved HTTPS media host.")
        overrides = dict(state.get("metadata", {}))
        for id_ in ids:
            overrides[id_] = dict(overrides.get(id_, {})) | {field: value}
        desk.save(state | {"metadata": overrides})
        for id_ in ids:
            desk.apply_metadata(id_)
        if desk.current and desk.current["id"] in ids and desk.on_metadata_change:
            desk.on_metadata_change(desk.current)
    else:
        raise ValueError("Unsupported batch action.")
    desk.move = None
    desk.changed()
    return f"Applied {operation.replace('_', ' ')} to {len(ids)} recordings."


def _checked_program(desk, raw):
    if not isinstance(raw, dict):
        raise ValueError("Invalid program draft.")
    name = raw.get("name")
    notes = raw.get("notes", "")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 120:
        raise ValueError("Program name must be 1–120 characters.")
    if not isinstance(notes, str) or len(notes) > 1000:
        raise ValueError("Program notes must be at most 1,000 characters.")
    ids = checked_ids(desk, raw.get("track_ids"), allow_repeats=True)
    return name.strip(), notes.strip(), ids


def _stored(desk, request):
    id_ = request.get("program_id")
    programs = desk.state.get("programs", {})
    if not isinstance(id_, str) or id_ not in programs:
        raise ValueError("That saved program no longer exists.")
    program = programs[id_]
    if request.get("revision") != program["revision"]:
        raise ValueError("This program has changed. Reopen it before editing or inserting.")
    return id_, program


def save_program(desk, request):
    name, notes, ids = _checked_program(desk, request.get("program"))
    raw = request["program"]
    programs = dict(desk.state.get("programs", {}))
    id_ = raw.get("id")
    if id_ is None:
        if len(programs) >= MAX_PROGRAMS:
            raise ValueError("This frequency already has 100 saved programs.")
        id_ = secrets.token_hex(12)
        revision = 1
    else:
        if not isinstance(id_, str) or id_ not in programs:
            raise ValueError("This program no longer exists.")
        if raw.get("revision") != programs[id_]["revision"]:
            raise ValueError("This program changed. Reopen it before saving.")
        revision = programs[id_]["revision"] + 1
    programs[id_] = {"id": id_, "name": name, "notes": notes,
                     "track_ids": ids, "revision": revision, "updated_at": int(time.time())}
    desk.save(desk.state | {"programs": programs})
    desk.changed()
    return f"Saved program: {name} ({len(ids)} recordings). No broadcast change."


def delete_program(desk, request):
    id_, program = _stored(desk, request)
    programs = dict(desk.state.get("programs", {}))
    del programs[id_]
    desk.save(desk.state | {"programs": programs})
    desk.changed()
    return f"Deleted saved draft: {program['name']}. Queued copies are unaffected."


def queue_program(desk, request):
    _, program = _stored(desk, request)
    placement = request.get("placement")
    if placement not in ("next", "end"):
        raise ValueError("Choose the beginning or end of the manual queue.")
    ids = checked_ids(desk, program["track_ids"], allow_repeats=True)
    if any(not desk.eligible(id_) for id_ in ids):
        raise ValueError("A program recording is currently held, disabled or unavailable.")
    lineup = desk.state["lineup"][:]
    if len(lineup) + len(ids) > MAX_QUEUE:
        raise ValueError("The queue would exceed 4,000 recordings.")
    lineup = ids + lineup if placement == "next" else lineup + ids
    desk.save(desk.state | {"lineup": lineup})
    desk.changed()
    return f"Inserted {program['name']} ({len(ids)} recordings) into the manual queue."
