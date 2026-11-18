#!/usr/bin/env python3
"""HUMKIN Station Desk 0.3 — deterministic, offline-first programming comparisons.

Runs the real StationV2 rotation policy, but NEVER decodes audio, opens an
Icecast source, updates Supabase, changes R2 objects or counts actual listeners.
"""
import argparse
import copy
import json
import math
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scheduler_v2 import StationV2

SCHEMA = "humkin.radio.station-lab/v1"
START = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)


def simulate(catalog, days=7, seed=2026, start=START):
    if not 1 <= days <= 30:
        raise ValueError("days must be between 1 and 30")
    if start.tzinfo is None:
        raise ValueError("start must include a timezone")
    station = StationV2(catalog, seed=seed)
    if not station.songs:
        raise ValueError("catalog has no playable songs")
    end = start + timedelta(days=days)
    now = start
    counts = Counter()
    kinds = Counter()
    last_song = {}
    last_bumper = {}
    repeats_bumper_60 = 0
    shortest_song_repeat = None
    gaps_between_bumpers = []
    last_bumper_at = None
    longest_without_bumper = 0.0
    total_song_seconds = 0.0
    total_bumper_seconds = 0.0
    sample = []
    while now < end:
        track = station.next(now)
        duration = float(track["duration"])
        if not math.isfinite(duration) or not 0 < duration <= 14400:
            raise ValueError("invalid catalog duration")
        identity = track["id"]
        kind = "bumper" if track.get("kind") == "bumper" else "song"
        counts[identity] += 1
        kinds[kind] += 1
        if len(sample) < 12:
            sample.append({"kind": kind, "track_id": identity,
                           "minute": round((now - start).total_seconds() / 60, 2)})
        if kind == "song":
            total_song_seconds += duration
            if identity in last_song:
                gap = (now - last_song[identity]).total_seconds() / 60
                shortest_song_repeat = (gap if shortest_song_repeat is None
                                        else min(shortest_song_repeat, gap))
            last_song[identity] = now
        else:
            total_bumper_seconds += duration
            if identity in last_bumper and (now - last_bumper[identity]).total_seconds() < 3600:
                repeats_bumper_60 += 1
            last_bumper[identity] = now
            previous = last_bumper_at or start
            gap = max(0.0, (now - previous).total_seconds() / 60)
            longest_without_bumper = max(longest_without_bumper, gap)
            if last_bumper_at:
                gaps_between_bumpers.append(gap)
            last_bumper_at = now + timedelta(seconds=duration)
        now += timedelta(seconds=duration)
    longest_without_bumper = max(
        longest_without_bumper, (now - (last_bumper_at or start)).total_seconds() / 60)
    return {
        "window_days_requested": days, "programmed_minutes": round((now - start).total_seconds() / 60, 2),
        "song_plays": kinds["song"], "bumper_plays": kinds["bumper"],
        "unique_songs": sum(1 for k in last_song if counts[k] > 0),
        "unique_bumpers": len(last_bumper),
        "song_airtime_pct": round(100 * total_song_seconds / (total_song_seconds + total_bumper_seconds), 2),
        "bumper_repeats_under_60m": repeats_bumper_60,
        "shortest_song_repeat_minutes": None if shortest_song_repeat is None else round(shortest_song_repeat, 2),
        "max_without_bumper_minutes": round(max(0, longest_without_bumper), 2),
        "average_between_bumpers_minutes": (
            round(sum(gaps_between_bumpers) / len(gaps_between_bumpers), 2)
            if gaps_between_bumpers else None),
        "first_12_selections": sample
    }


def compare(catalog, *, days=7, seed=2026, start=START,
            candidate_bumper_every=3, candidate_release_multiplier=None, origin="fixture"):
    if not 0 <= candidate_bumper_every <= 20:
        raise ValueError("candidate bumper interval must be 0..20")
    if candidate_release_multiplier not in (None, 1, 2):
        raise ValueError("candidate release multiplier must be 1 or 2")
    if int(catalog.get("policy_version", 0)) != 2:
        raise ValueError("Station Lab requires a StationV2 catalog (policy_version=2)")
    a = copy.deepcopy(catalog)
    b = copy.deepcopy(catalog)
    b.setdefault("settings", {})["bumper_every"] = candidate_bumper_every
    if candidate_release_multiplier is not None:
        b.setdefault("rotation", {}).setdefault("featured_rotation", {})[
            "multiplier"] = candidate_release_multiplier
    def policy(c):
        return {
            "bumper_every": int(c.get("settings", {}).get("bumper_every") or 0),
            "featured_multiplier": int(c.get("rotation", {}).get(
                "featured_rotation", {}).get("multiplier") or 1),
            "seasonal_multiplier": int(c.get("rotation", {}).get(
                "seasonal_rotation", {}).get("multiplier") or 1),
            "chart_snapshot_count": len(c.get("chart_ids", [])),
            "scheduled_programs_count": len([x for x in c.get("shows", []) if x.get("is_active")])
        }
    baseline = simulate(a, days, seed, start)
    candidate = simulate(b, days, seed, start)
    metric_keys = ("song_plays", "bumper_plays", "unique_songs",
                   "song_airtime_pct", "bumper_repeats_under_60m",
                   "max_without_bumper_minutes")
    return {
        "schema": SCHEMA, "source": origin,
        "start_utc": start.astimezone(timezone.utc).isoformat(),
        "seed": seed, "days": days,
        "baseline": {"policy": policy(a), "metrics": baseline},
        "candidate": {"policy": policy(b), "metrics": candidate},
        "delta_candidate_minus_baseline": {
            key: round(candidate[key] - baseline[key], 2) for key in metric_keys},
        "caveats": [
            "Simulated selections, not confirmed broadcasts, listener activity or listener experience.",
            "StationV2 deterministic policies only; not the browser shared-clock shuffle.",
            "Nominal catalog durations; ignores download delays, crossfades, FFmpeg issues and background suspension.",
            "An equal-seed comparison changes policy, but not necessarily the same RNG calls or ordering."
        ]
    }


def inspect_receiver(path):
    path = Path(path)
    if path.stat().st_size > 512 * 1024:
        raise ValueError("signal report too large")
    source = json.loads(path.read_text(encoding="utf-8"))
    if source.get("schema") != "humkin.radio.blackbox/v1" or not isinstance(source.get("events"), list):
        raise ValueError("not a HUMKIN browser Black Box report")
    if len(source["events"]) > 256:
        raise ValueError("too many events")
    allowed = {"boot_ready", "boot_error", "mode_change", "source_select",
               "play", "playing", "pause", "boundary", "audio_error",
               "play_rejected", "stalled", "waiting", "report_signal"}
    observed = [e for e in source["events"] if isinstance(e, dict) and e.get("event") in allowed]
    counts = Counter(e["event"] for e in observed)
    selections = [e.get("track_id") for e in observed if e["event"] == "source_select"]
    consecutive = sum(1 for i in range(1, len(selections))
                      if selections[i] and selections[i] == selections[i-1])
    return {
        "schema": "humkin.radio.signal-inspection/v1",
        "events_examined": len(observed), "event_counts": dict(counts),
        "consecutive_same_source_selections": consecutive,
        "error_or_stall_events": counts["audio_error"] + counts["play_rejected"] +
                                 counts["stalled"] + counts["waiting"] + counts["boot_error"],
        "limitations": "Local browser events only; does not confirm server transmission or identify network root cause."
    }


def main(argv=None):
    p = argparse.ArgumentParser(description="HUMKIN programming laboratory: no changes to the live dial")
    source = p.add_mutually_exclusive_group(required=True)
    source.add_argument("--fixture", type=Path, help="local exported StationV2 catalog")
    source.add_argument("--live", action="store_true", help="read public currently published radio catalog")
    source.add_argument("--inspect-black-box", type=Path, help="summarize an exported browser diagnostic report")
    p.add_argument("--days", type=int, default=7, help="1-30 days of simulated selections")
    p.add_argument("--seed", type=int, default=2026)
    p.add_argument("--start", default=START.isoformat(), help="timezone-aware ISO 8601 start")
    p.add_argument("--candidate-bumper-every", type=int, default=3,
                   help="compare setting (0=off, otherwise 1..20)")
    p.add_argument("--candidate-release-multiplier", type=int, choices=(1, 2))
    p.add_argument("--out", type=Path, help="save the JSON receipt locally")
    args = p.parse_args(argv)
    if args.inspect_black_box:
        result = inspect_receiver(args.inspect_black_box)
    else:
        if args.fixture:
            catalog = json.loads(args.fixture.read_text(encoding="utf-8"))
            origin = "fixture"
        else:
            from engine import live_catalog
            catalog = live_catalog()
            origin = "published_catalog_at_run_time"
        start = datetime.fromisoformat(args.start.replace("Z", "+00:00"))
        result = compare(catalog, days=args.days, seed=args.seed, start=start,
                         candidate_bumper_every=args.candidate_bumper_every,
                         candidate_release_multiplier=args.candidate_release_multiplier,
                         origin=origin)
    output = json.dumps(result, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(output, encoding="utf-8")
    print(output, end="")


if __name__ == "__main__":
    main()
