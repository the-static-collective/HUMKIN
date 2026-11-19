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
from zoneinfo import ZoneInfo

CENTRAL = ZoneInfo("America/Chicago")


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
    seasonal_hashes = {h for h in seasonal.get("sha256s", [])
                       if isinstance(h, str) and len(h) == 64 and
                       all(c in "0123456789abcdef" for c in h)}
    bonus = []
    for id_ in song_ids:
        release = id_ in featured
        if release:
            bonus.append(id_)
        # A seasonal record receives 3 total plays, not 2+3.
        if seasonal.get("multiplier") == 3 and (
            by_id[id_].get("seasonal") is True or id_ in explicit
            or by_id[id_].get("sha256") in seasonal_hashes
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
    profile = policy.get("profiles", {}).get(id_, {})
    sec = float(t.get("duration") or 0)
    short_max = float(policy.get("short_max_seconds", 19))
    medium_max = float(policy.get("medium_max_seconds", 60))
    # Artistic content, fictional claims and opener titles are not holds.
    if (profile.get("hold") is True
            or sec <= 0 or sec > float(policy.get("maximum_break_seconds", 180))):
        return None
    return "short" if sec <= short_max else "medium" if sec < medium_max else "long"


class ShuffledBag:
    def __init__(self, ids, rng):
        self.ids = ids[:]
        self.rng = rng
        self.bag = []
        self.last = None

    def take(self, avoid=(), family_of=None):
        if not self.ids:
            return None
        if not self.bag:
            self.bag = self.ids[:]
            self.rng.shuffle(self.bag)
            if len(self.bag) > 1 and self.bag[-1] == self.last:
                self.bag[0], self.bag[-1] = self.bag[-1], self.bag[0]
        # Space verified alternate cuts of the SAME recording only.
        # Never pull a cart from the next bag to satisfy spacing.
        if family_of and avoid:
            position = next((i for i in range(len(self.bag) - 1, -1, -1)
                             if family_of(self.bag[i]) not in avoid), None)
            id_ = self.bag.pop(position) if position is not None else self.bag.pop()
        else:
            id_ = self.bag.pop()
        self.last = id_
        return id_


def allowed_bumper(id_, rules, when=None, clock=False):
    """An owner may explicitly restrict a cart. Titles never create holds.

    Time-varying rules cannot alter Same-Time's fixed epoch: that browser
    clock only uses manual holds. Streaming evaluates dayparts at each break.
    """
    local = (when or datetime.now(timezone.utc)).astimezone(CENTRAL)
    day = (local.weekday() + 1) % 7
    minute = local.hour * 60 + local.minute
    today = local.date().isoformat()
    for rule in (rules if isinstance(rules, list) else [])[:60]:
        if not isinstance(rule, dict) or rule.get("enabled") is not True:
            continue
        if id_ not in rule.get("track_ids", []):
            continue
        kind = rule.get("kind")
        if kind == "hold":
            return False
        if clock:
            continue
        if kind == "daypart":
            if (day not in rule.get("days", []) or
                    not isinstance(rule.get("start_minute"), int) or
                    not isinstance(rule.get("end_minute"), int) or
                    not rule["start_minute"] <= minute < rule["end_minute"]):
                return False
        elif kind == "date":
            first, last = rule.get("start_date"), rule.get("end_date")
            if not isinstance(first, str) or not isinstance(last, str) or not first <= today <= last:
                return False
    return True


def arrange_bumpers(sequence, tracks, owner_groups, bag_sizes, near=3):
    """Best-effort attraction then repulsion, within the current shuffled
    duration bag. Song order, cart inventory, and lane counts are unchanged."""
    if not isinstance(owner_groups, list):
        return sequence
    groups = [g for g in owner_groups[:60]
              if isinstance(g, dict) and g.get("enabled") is True
              and g.get("kind") in ("attract", "repel")
              and isinstance(g.get("track_ids"), list)
              and len(set(g["track_ids"])) >= 2]
    if not groups:
        return sequence
    bp = [{"at": i, "id": id_, "lane": bumper_lane(tracks[id_], {})}
          for i, id_ in enumerate(sequence) if tracks[id_].get("kind") == "bumper"]
    lane_positions = {"short": [], "medium": [], "long": []}
    ordinals = {}
    for i, entry in enumerate(bp):
        lane = entry["lane"]
        if lane in lane_positions:
            ordinals[i] = (lane, len(lane_positions[lane]))
            lane_positions[lane].append(i)

    def same_bag(a, b):
        if a not in ordinals or b not in ordinals:
            return False
        la, ia = ordinals[a]
        lb, ib = ordinals[b]
        size = bag_sizes.get(la, 0)
        return bool(size >= 2 and la == lb and ia // size == ib // size)

    for i, current in enumerate(bp):
        for g in groups:
            members = set(g["track_ids"])
            if g["kind"] != "attract" or current["id"] not in members:
                continue
            source = next((j for j in range(i+1, len(bp))
                           if bp[j]["id"] in members and bp[j]["id"] != current["id"]), None)
            if source is None or source - i <= near:
                continue
            target = next((j for j in range(i+1, min(len(bp), i+near+1))
                           if same_bag(source, j)), None)
            if target is not None:
                bp[source]["id"], bp[target]["id"] = bp[target]["id"], bp[source]["id"]

    for i, current in enumerate(bp):
        if i == 0:
            continue
        prior = [b["id"] for b in bp[max(0, i-near):i]]
        conflict = any(g["kind"] == "repel" and current["id"] in g["track_ids"] and
                       any(x in g["track_ids"] for x in prior) for g in groups)
        if not conflict:
            continue
        for j in range(i+1, len(bp)):
            if not same_bag(i, j):
                continue
            other = bp[j]["id"]
            if any(g["kind"] == "repel" and other in g["track_ids"] and
                   any(x in g["track_ids"] for x in prior) for g in groups):
                continue
            bp[i]["id"], bp[j]["id"] = bp[j]["id"], bp[i]["id"]
            break
    out = sequence[:]
    for b in bp:
        out[b["at"]] = b["id"]
    return out


def with_bumpers(songs, tracks, settings, policy, rng):
    """φ short drops; medium ~11m; long substitutes every ~22.5m."""
    freq = int(settings.get("bumper_every", 0) or 0)
    if not 1 <= freq <= 20 or not songs:
        return songs[:]
    groups = {"short": [], "medium": [], "long": []}
    feature_only = set(policy.get("feature_only_spoken_sha256s", []))
    for id_, t in tracks.items():
        if t.get("kind") != "bumper" or t.get("sha256") in feature_only:
            continue
        lane = bumper_lane(t, policy)
        if lane and allowed_bumper(id_, settings.get("bumper_rules", []), clock=True):
            groups[lane].append(id_)
    bags = {lane: ShuffledBag(sorted(ids), rng) for lane, ids in groups.items()}
    def pick(lane):
        return bags[lane].take()
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
            selected = pick("long")
            while next_long <= nominal:
                next_long += long_every
            while next_mid <= nominal:
                next_mid += mid_period
        elif groups["medium"] and nominal >= next_mid:
            long_soon = groups["long"] and next_long - nominal <= mid_every * .55
            if not long_soon and nominal - last_anchor >= mid_every * .55:
                selected = pick("medium")
            while next_mid <= nominal:
                next_mid += mid_period
        elif short_due:
            selected = pick("short")
        if selected is not None:
            sequence.append(selected)
            if selected in groups["medium"] or selected in groups["long"]:
                last_anchor = nominal
            nominal += float(tracks[selected]["duration"])
    return arrange_bumpers(sequence, tracks, settings.get("bumper_groups", []),
                           {lane:len(ids) for lane, ids in groups.items()})


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
        self.eligible = lambda id_: True
        self.weight = lambda id_: 0

    def program(self, when=None):
        return active_program(self.catalog, self.by_id, when)

    def _new_cycle(self):
        tracks = {id_: item for id_, item in self.by_id.items() if self.eligible(id_)}
        songs = [id_ for id_ in self.songs if id_ in tracks]
        base = mix_eras(songs, self.rng)
        bonus = featured_extra(songs, tracks, self.catalog.get("rotation", {}))
        sequence = add_bonus_slots(base, bonus, self.rng)
        charts = chart_extra(songs + bonus, tracks, self.catalog.get("chart_ids", []), self.rng)
        counts = Counter(base + bonus + charts)
        # Each step halves/doubles the programmed number of slots. For odd
        # counts, carry the fractional share between cycles.
        targets = {}
        for id_, count in counts.items():
            step = self.weight(id_)
            numerator = count * 2 ** max(0, step)
            denominator = 2 ** max(0, -step)
            targets[id_] = ((self.cycle_no + 1) * numerator // denominator
                            - self.cycle_no * numerator // denominator)
        if songs and not any(targets.values()):
            # A small catalog must still fill the air.
            targets[max(base, key=lambda id_: self.weight(id_))] = 1
        base = [id_ for id_ in base if targets[id_]]
        extras = [id_ for id_ in base for _ in range(targets[id_] - 1)]
        # Preserve the existing release then chart insertion passes whenever
        # nobody has adjusted rotation.
        if any(self.weight(id_) for id_ in songs):
            sequence = add_bonus_slots(base, extras, self.rng)
        else:
            sequence = add_bonus_slots(sequence, charts, self.rng)
        rotation = self.catalog.get("rotation", {})
        policy = dict(rotation.get("bumper_brain", {}))
        policy["feature_only_spoken_sha256s"] = rotation.get("feature_only_spoken_sha256s", [])
        self.queue.extend(with_bumpers(sequence, tracks, self.catalog.get("settings", {}),
                                       policy, self.rng))
        self.cycle_no += 1

    def pending(self, when=None, limit=6):
        """Return scheduler slot keys and track IDs without consuming a slot."""
        eligible = {id_: item for id_, item in self.by_id.items() if self.eligible(id_)}
        show = active_program(self.catalog, eligible, when)
        if show:
            cursor = self.show_cursor if self.show_id == show["id"] else 0
            ordered = show["track_ids"]
            positions = range(cursor, cursor + len(ordered))
            return [(("show", show["id"], index), ordered[index % len(ordered)])
                    for index in positions if ordered[index % len(ordered)] in eligible][:limit]
        if not any(id_ in eligible for id_ in self.queue) and any(id_ in eligible for id_ in self.songs):
            self.queue.clear()
            self._new_cycle()
        return [(("rotation", self.cycle_no, index), id_)
                for index, id_ in enumerate(self.queue) if id_ in eligible and (eligible[id_].get("kind") != "bumper"
                    or allowed_bumper(id_, self.catalog.get("settings", {}).get("bumper_rules", []), when))][:limit]

    def take(self, slot):
        (kind, lane, index), id_ = slot
        if kind == "show":
            self.show_id = lane
            self.show_cursor = index + 1
        else:
            self.show_id = None
            for _ in range(index + 1):
                self.queue.popleft()
        return self.by_id[id_]

    def next(self, when=None):
        pending = self.pending(when, limit=1)
        if not pending:
            raise RuntimeError("No enabled published songs available")
        return self.take(pending[0])
