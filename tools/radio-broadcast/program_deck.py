"""Compile editorially reviewed Gambits into a bounded Cloud Autopilot window.
This module makes proposals, NOT station authorization. Publishing requires the
existing owner-held R2 vault and explicit action in autopilot_publisher.py.
"""
from datetime import datetime, date, time, timezone, timedelta
from hashlib import sha256
import json
import random
import re
from zoneinfo import ZoneInfo

SCHEMA="humkin.program.reviewed/v1"
PROPOSAL="humkin.program.proposal/v1"
UTC=timezone.utc
DURATIONS={30,60,90,120}
WHEN={"unheard","new-album","night","short","always"}
THEN={"least-played","different-album","shortest","longest","surprise"}
UUID=re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$", re.I)
STATION=re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")


def validate_packet(packet, frequency):
    if not isinstance(packet,dict) or packet.get("schema")!=SCHEMA:
        raise ValueError("Expected an owner-exported reviewed Gambit packet")
    if packet.get("state")!="approved" or not UUID.fullmatch(str(packet.get("id",""))) or not UUID.fullmatch(str(packet.get("reviewed_by",""))):
        raise ValueError("Editorial approval receipt incomplete")
    if not isinstance(packet.get("reviewed_at"),str) or "T" not in packet["reviewed_at"]:
        raise ValueError("Review timestamp missing")
    proposal=packet.get("proposal")
    if not isinstance(proposal,dict) or proposal.get("schema")!=PROPOSAL:
        raise ValueError("Unknown proposal schema")
    if not STATION.fullmatch(str(proposal.get("station_id",""))) or proposal["station_id"]!=frequency:
        raise ValueError("Frequency mismatch: proposal cannot control another station")
    try:
        requested_day=date.fromisoformat(proposal["day"])
        requested_time=time.fromisoformat(proposal["time"])
    except (TypeError,ValueError,KeyError):
        raise ValueError("Invalid station day and time")
    if requested_time.second or requested_time.minute % 15:
        raise ValueError("Proposed program must begin at a quarter-hour")
    minutes=proposal.get("minutes")
    if not isinstance(minutes,int) or minutes not in DURATIONS:
        raise ValueError("Invalid program length")
    rules=proposal.get("rules")
    if not isinstance(rules,list) or not 1<=len(rules)<=8:
        raise ValueError("A proposal needs 1–8 ordered rules")
    cleaned=[]
    for r in rules:
        if not isinstance(r,dict) or r.get("when") not in WHEN or r.get("action") not in THEN or type(r.get("enabled")) is not bool:
            raise ValueError("Untrusted or executable Gambit action rejected")
        cleaned.append({k:r[k] for k in ("when","action","enabled")})
    if not any(r["enabled"] for r in cleaned):
        raise ValueError("At least one Gambit must be enabled")
    return proposal,cleaned,requested_day,requested_time,minutes


def proposed_utc(day,clock):
    tz=ZoneInfo("America/Chicago")
    naive=datetime.combine(day,clock)
    local=naive.replace(tzinfo=tz,fold=0)
    utc=local.astimezone(UTC)
    if utc.astimezone(tz).replace(tzinfo=None)!=naive:
        raise ValueError("Proposed Central time does not exist on this date (DST)")
    return utc


def duration(track):
    return sum(track["durations_ms"])


def select_deck(packet, prepared, frequency):
    proposal,rules,day,clock,minutes=validate_packet(packet,frequency)
    if not 1<=len(prepared)<=500 or any(not t.get("durations_ms") or duration(t)<=0 for t in prepared):
        raise ValueError("No valid owner-approved, pre-encoded R2 songs")
    # The local approved crate is the only media authority; the proposal
    # supplies selection logic, never a URL or arbitrary new recording.
    source=[dict(t) for t in prepared]
    counts={t["id"]:0 for t in source}
    ids=set()
    if len(counts)!=len(source):raise ValueError("Duplicate approved recording IDs")
    selected=[]
    total=0
    seed=int(sha256(packet["id"].encode("ascii")).hexdigest()[:16],16)
    rng=random.Random(seed)
    hour=clock.hour
    while total<minutes*60000:
        pool=[t for t in source if t["id"] not in ids]
        if not pool:
            ids.clear()
            pool=source[:]
        last=selected[-1] if selected else None
        chosen=None
        for rule in rules:
            if not rule["enabled"]:continue
            when=rule["when"]
            options=pool
            if when=="unheard":
                options=[t for t in pool if counts[t["id"]]==0]
            elif when=="new-album":
                options=[t for t in pool if last and t.get("album")!=last.get("album")]
            elif when=="night":
                options=pool if (hour>=19 or hour<6) else []
            elif when=="short":
                options=[t for t in pool if duration(t)<=180000]
            if not options:continue
            action=rule["action"]
            if action=="different-album" and last:
                other=[t for t in options if t.get("album")!=last.get("album")]
                if other:options=other
            if action=="least-played":
                chosen=min(options,key=lambda t:(counts[t["id"]],t["id"]))
            elif action=="shortest":
                chosen=min(options,key=lambda t:(duration(t),t["id"]))
            elif action=="longest":
                chosen=max(options,key=lambda t:(duration(t),t["id"]))
            else:
                chosen=rng.choice(options)
            break
        if chosen is None:chosen=min(pool,key=lambda t:(counts[t["id"]],t["id"]))
        selected.append(chosen)
        counts[chosen["id"]]+=1
        ids.add(chosen["id"])
        total+=duration(chosen)
        if len(selected)>500:
            raise ValueError("Guest block exceeds cloud program safety limits")
    return selected


def schedule_guest(existing,frequency,guest,packet,now=None):
    # Reuse the production clock boundary logic instead of inventing a second
    # playout timeline. The old rotation must exist so returning is possible.
    from autopilot_publisher import SCHEMA as CLOUD_SCHEMA, next_boundary, clock_ms, iso
    import datetime as dt
    proposal,rules,day,clock,minutes=validate_packet(packet,frequency)
    if existing is None or existing.get("schema")!=CLOUD_SCHEMA or existing.get("station_id")!=frequency:
        raise ValueError("Seed and verify a house Cloud Autopilot schedule before booking a guest")
    revisions=list(existing.get("revisions",[]))
    if not 1<=len(revisions)<=30:
        raise ValueError("Revision history cannot fit a guest and return; review rotation")
    requested=proposed_utc(day,clock)
    current=now or datetime.now(UTC)
    if requested<=current+timedelta(minutes=3):
        raise ValueError("Schedule guest programming at least three minutes ahead")
    previous=revisions[-1]
    target_ms=round(requested.timestamp()*1000)
    if target_ms<=clock_ms(previous["effective_at"]):
        raise ValueError("Guest overlaps an existing future program")
    start_ms=next_boundary(previous,target_ms)
    when=datetime.fromtimestamp(start_ms/1000,UTC)
    proposed_id="g-"+packet["id"].replace("-","")[:22]
    guest_revision={"id":proposed_id,"effective_at":iso(when),"tracks":guest}
    # Let the show finish its current song, then restore the exact prior
    # house rotation. Both transitions are deterministic segment boundaries.
    stop_ms=next_boundary(guest_revision,start_ms+minutes*60000)
    restore=datetime.fromtimestamp(stop_ms/1000,UTC)
    return_revision={"id":"r-"+proposed_id[2:]+"-return",
        "effective_at":iso(restore),"tracks":previous["tracks"]}
    return {"schema":CLOUD_SCHEMA,"station_id":frequency,
        "revisions":revisions+[guest_revision,return_revision]}
