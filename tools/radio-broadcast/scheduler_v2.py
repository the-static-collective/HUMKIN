"""HUMKIN Station One: server-side programming policy (v2).

Preserves editorial gates: only published/approved songs and bumpers enter the
catalog. A separate helper builds finite cycles for the existing FFmpeg engine.
Not a byte-for-byte port of the browser's deterministic UTC shared clock: one
continuous stream runs its own sequence, daypart boundaries are checked before
each new recording, and chart/policy snapshots refresh on transmitter restart.
"""
from collections import Counter, deque
from datetime import datetime, timezone
import math
import random
import re
from zoneinfo import ZoneInfo

CENTRAL = ZoneInfo("America/Chicago")
RISKY_TITLE = re.compile(r"\b(top of the hour|bottom of the hour|requests we re taking|we re taking requests)\b")
SHOW_OPENER = re.compile(r"\b(opener|opening|intro for)\b")


def active_program(catalog, tracks, when):
    local = (when or datetime.now(timezone.utc)).astimezone(CENTRAL)
    day = (local.weekday() + 1) % 7
    minute = local.hour * 60 + local.minute
    eligible = [
        program for program in catalog.get("shows", [])
        if program.get("is_active") and day in program.get("days", [])
        and int(program.get("start_minute", 0)) <= minute < int(program.get("end_minute", 0))
        and any(t in tracks for t in program.get("track_ids", []))
    ]
    eligible.sort(key=lambda p: (-int(p.get("priority", 0)),
                                 -int(p.get("start_minute", 0)), str(p.get("id", ""))))
    return eligible[0] if eligible else None


def mix_eras(song_ids, rng):
    """Interleave catalog-arrival thirds, without pretending to know song age."""
    shuffled = song_ids[:]
    rng.shuffle(shuffled)
    if len(shuffled) < 9:
        return shuffled
    first, second = len(song_ids) // 3, 2 * len(song_ids) // 3
    positions = {id_: i for i, id_ in enumerate(song_ids)}
    lanes = [[], [], []]
    for id_ in shuffled:
        index = positions[id_]
        lanes[0 if index < first else 1 if index < second else 2].append(id_)
    totals = [len(lane) for lane in lanes]
    played = [0, 0, 0]
    last, run = -1, 0
    result = []
    while any(lanes):
        slot = len(result)
        scores = [
            ((slot + 1) * totals[i] / len(song_ids) - played[i]
             + rng.random() * 0.9 - (5 if run >= 2 else .15 if run else 0)
             * (i == last)) if lanes[i] else -1e6
            for i in range(3)
        ]
        chosen = max(range(3), key=lambda i: scores[i])
        result.append(lanes[chosen].pop(0))
        played[chosen] += 1
        run = run + 1 if chosen == last else 1
        last = chosen
    return result


def add_bonus_slots(base, bonuses, rng):
    """Spread release/seasonal/chart bonuses; guard the edges of each cycle."""
    if not bonuses:
        return base[:]
    bonuses = bonuses[:]
    rng.shuffle(bonuses)
    out = base[:]
    guard = min(4, len(base) // 4)
    for i, id_ in enumerate(bonuses):
        # Keep original cycle head and tail intact, particularly where the
        # next era-mixed cycle joins this one. The interior grows as we insert.
        low, high = guard, len(out) - guard
        target = low + round((i + 1) * (high - low) / (len(bonuses) + 1))
        target = min(max(low, target), high)
        candidates = [target]
        for offset in range(1, min(8, len(out)) + 1):
            candidates += [target + offset, target - offset]
        for at in candidates:
            if low <= at <= high and id_ not in out[max(0, at - 4):at + 4]:
                target = at
                break
        out.insert(target, id_)
    return out


def featured_extra(song_ids, by_id, rotation):
    if rotation.get("featured_rotation", {}).get("multiplier") != 2:
        featured = set()
    else:
        policy = rotation["featured_rotation"]
        albums = set(policy.get("albums", []))
        singles = set(policy.get("singles", []))
        featured = {
            id_ for id_ in song_ids
            if by_id[id_].get("album") in albums or id_ in singles
            or (by_id[id_].get("source") == "cloud"
                and by_id[id_].get("is_single") is True)
        }
    seasonal = rotation.get("seasonal_rotation", {})
    explicit = set(seasonal.get("track_ids", []))
    bonus = []
    for id_ in song_ids:
        release = id_ in featured
        if release:
            bonus.append(id_)
        # A seasonal record receives 3 total plays, not 2+3.
        if seasonal.get("multiplier") == 3 and (
            by_id[id_].get("seasonal") is True or id_ in explicit
        ):
            bonus.extend([id_] * (1 if release else 2))
    return bonus


def chart_extra(song_ids, by_id, ranked_ids, rng):
    """Respect ~7% target and cap bonus picks; no chart data means no chart."""
    ranked = [id_ for id_ in dict.fromkeys(ranked_ids)
              if id_ in by_id and by_id[id_].get("kind") != "bumper"]
    if not ranked or not song_ids:
        return []
    target = sum(float(by_id[id_]["duration"]) for id_ in song_ids) * 7 / 93
    tiers = [ranked[:7], ranked[7:21], ranked[21:42]]
    for tier in tiers:
        rng.shuffle(tier)
    picks, played, counts = [], 0.0, Counter()
    max_picks = math.ceil(len(song_ids) * .12)
    attempts = 0
    while played < target and len(picks) < max_picks and attempts < max_picks * 14:
        attempts += 1
        roll = rng.random()
        wanted = 0 if roll < .35 else 1 if roll < .7 else 2
        chosen = None
        for offset in range(3):
            tier = tiers[(wanted + offset) % 3]
            chosen = next((x for x in tier if counts[x] < 2), None)
            if chosen is not None:
                tier.append(tier.pop(tier.index(chosen)))
                break
        if chosen is None:
            break
        picks.append(chosen)
        counts[chosen] += 1
        played += float(by_id[chosen]["duration"])
    return picks


def bumper_lane(t, policy):
    id_ = str(t.get("id", ""))
    title = " ".join(re.findall(r"[a-z0-9]+", t.get("title", "").lower()))
    profile = policy.get("profiles", {}).get(id_, {})
    sec = float(t.get("duration") or 0)
    short_max = float(policy.get("short_max_seconds", 19))
    medium_max = float(policy.get("medium_max_seconds", 60))
    if (profile.get("hold") is True or profile.get("role") == "show_opener"
            or (not profile.get("role") and SHOW_OPENER.search(title))
            or RISKY_TITLE.search(title)
            or sec <= 0 or sec > float(policy.get("maximum_break_seconds", 180))):
        return None
    return "short" if sec <= short_max else "medium" if sec < medium_max else "long"


class ShuffledBag:
    def __init__(self, ids, rng):
        self.ids = ids[:]
        self.rng = rng
        self.bag = []
        self.last = None

    def take(self):
        if not self.ids:
            return None
        if not self.bag:
            self.bag = self.ids[:]
            self.rng.shuffle(self.bag)
            if len(self.bag) > 1 and self.bag[-1] == self.last:
                self.bag[0], self.bag[-1] = self.bag[-1], self.bag[0]
        id_ = self.bag.pop()
        self.last = id_
        return id_


def with_bumpers(songs, tracks, settings, policy, rng):
    """φ short drops; medium ~11m; long substitutes every ~22.5m."""
    freq = int(settings.get("bumper_every", 0) or 0)
    if not 1 <= freq <= 20 or not songs:
        return songs[:]
    groups = {"short": [], "medium": [], "long": []}
    for id_, t in tracks.items():
        if t.get("kind") != "bumper":
            continue
        lane = bumper_lane(t, policy)
        if lane:
            groups[lane].append(id_)
    bags = {lane: ShuffledBag(sorted(ids), rng) for lane, ids in groups.items()}
    if not any(groups.values()):
        return songs[:]
    mean = sum(float(tracks[id_]["duration"]) for id_ in songs) / len(songs)
    if mean <= 0:
        return songs[:]
    scale = freq / 4.0
    mid_every = float(policy.get("medium_target_seconds", 690)) * scale
    long_every = float(policy.get("long_target_seconds", 1350)) * scale
    mid_period = long_every if groups["long"] else mid_every
    next_mid, next_long = mid_every, long_every
    phi = (1 + math.sqrt(5)) / 2

    def gap(pulse):
        return max(1, round((1 + math.floor(((pulse + 1) * phi) % 1 * 4)) * scale))

    pulse = 0
    next_short = gap(pulse)
    pulse += 1
    nominal = 0.0
    last_anchor = -float("inf")
    sequence = []
    for i, song in enumerate(songs):
        sequence.append(song)
        nominal += mean
        short_due = i + 1 >= next_short
        if short_due:
            next_short += gap(pulse)
            pulse += 1
        selected = None
        if groups["long"] and nominal >= next_long:
            selected = bags["long"].take()
            while next_long <= nominal:
                next_long += long_every
            while next_mid <= nominal:
                next_mid += mid_period
        elif groups["medium"] and nominal >= next_mid:
            long_soon = groups["long"] and next_long - nominal <= mid_every * .55
            if not long_soon and nominal - last_anchor >= mid_every * .55:
                selected = bags["medium"].take()
            while next_mid <= nominal:
                next_mid += mid_period
        elif short_due:
            selected = bags["short"].take()
        if selected is not None:
            sequence.append(selected)
            if selected in groups["medium"] or selected in groups["long"]:
                last_anchor = nominal
            nominal += float(tracks[selected]["duration"])
    return sequence


class StationV2:
    def __init__(self, catalog, seed=2026):
        self.catalog = catalog
        self.by_id = {t["id"]: t for t in catalog["tracks"]
                      if isinstance(t.get("duration"), (int, float)) and t["duration"] > 0}
        self.songs = [id_ for id_, t in self.by_id.items() if t.get("kind") != "bumper"]
        self.rng = random.Random(seed)
        self.cycle_no = 0
        self.queue = deque()
        self.show_id = None
        self.show_cursor = 0

    def program(self, when=None):
        return active_program(self.catalog, self.by_id, when)

    def _new_cycle(self):
        base = mix_eras(self.songs, self.rng)
        bonus = featured_extra(self.songs, self.by_id, self.catalog.get("rotation", {}))
        sequence = add_bonus_slots(base, bonus, self.rng)
        charts = chart_extra(self.songs + bonus, self.by_id,
                             self.catalog.get("chart_ids", []), self.rng)
        sequence = add_bonus_slots(sequence, charts, self.rng)
        sequence = with_bumpers(sequence, self.by_id,
                                self.catalog.get("settings", {}),
                                self.catalog.get("rotation", {}).get("bumper_brain", {}),
                                self.rng)
        self.cycle_no += 1
        self.queue = deque(sequence)

    def next(self, when=None):
        show = self.program(when)
        if show:
            valid = [id_ for id_ in show["track_ids"] if id_ in self.by_id]
            if self.show_id != show["id"]:
                self.show_id = show["id"]
                self.show_cursor = 0
            if valid:
                item = self.by_id[valid[self.show_cursor % len(valid)]]
                self.show_cursor += 1
                return item
        self.show_id = None
        if not self.queue:
            self._new_cycle()
        if not self.queue:
            raise RuntimeError("No enabled published songs available")
        return self.by_id[self.queue.popleft()]
