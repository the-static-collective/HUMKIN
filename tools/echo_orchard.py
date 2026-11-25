"""Append-only daily archive of generated MIDI seeds; never source audio."""
import base64
import datetime as dt
import hashlib
import json
from pathlib import Path
import re

SCHEMA="humkin.echo-orchard/day/v1"
INDEX="humkin.echo-orchard/index/v1"
PIN="f5709e096756055e1a28c95ac5f9e79873319631"
HASH=re.compile(r"[a-f0-9]{64}\Z")

def digest(value):
    if not isinstance(value,str):raise ValueError("Missing digest")
    raw=value.removeprefix("sha256:")
    if not HASH.fullmatch(raw):raise ValueError("Malformed digest")
    return raw

def verify_native(p,source):
    midi=p["midi"];receipt=p["native_receipt"];proposal=p["native_proposal"];evidence=p["signal_evidence"]
    raw=base64.b64decode(midi["base64"],validate=True)
    if not 14<=len(raw)<=4096 or raw[:4]!=b"MThd" or int.from_bytes(raw[4:8],"big")!=6:
        raise ValueError("Invalid bounded MIDI seed")
    if midi["byte_length"]!=len(raw) or digest(midi["sha256"])!=hashlib.sha256(raw).hexdigest():
        raise ValueError("MIDI digest mismatch")
    if receipt["midi"]!={k:midi[k] for k in ("sha256","byte_length","profile")}:
        raise ValueError("Receipt MIDI mismatch")
    for field in ("receipt_hash","proposal_hash","signal_evidence_hash"):
        if digest(receipt[field])!=digest(p[field]):raise ValueError("Receipt mismatch")
    if digest(evidence["signal_profile_hash"])!=digest(p["signal_evidence_hash"]):raise ValueError("Evidence mismatch")
    if digest(receipt["source_window"]["source_sha256"])!=digest(source["segment_sha256"]):
        raise ValueError("Source segment mismatch")
    if digest(receipt["source_window"]["audio_sha256"])!=digest(p["source_audio_sha256"]):raise ValueError("Source WAV mismatch")
    v=proposal["value"]
    if v["pitches"]!=p["pitches"] or v["tempoBpm"]!=p["tempo_bpm"] or v["durationsQuarter"]!=p["durations_quarter"]:
        raise ValueError("Proposal summary mismatch")
    return raw

def seed_from(response,source):
    if response.get("agent")!="HAUNTED PHONOGRAPHY" or response.get("method")!="haunted-phonograph/field-answer-v0" or response.get("engine_commit")!=PIN or response.get("source_sample_id")!=source.get("id"):
        raise ValueError("Not a native Field Answer response")
    p=response["proposal"];verify_native(p,source)
    ident=digest(p["receipt_hash"])
    return {"id":ident,"state":"proposal_only","created_at":source["observed_at"],"media_at":source["media_at"],
            "station_id":source["station_id"],"transport":source.get("transport","hot_hls"),
            "source_sample_id":source["id"],"source_segment_sha256":source["segment_sha256"],
            "recording_id":source["recording_id"],"track_title":source["track_title"],
            "engine_commit":PIN,"response_id":response["id"],"proposal":p}

def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    temporary.replace(path)

def archive(root,seed):
    root=Path(root)
    if seed["state"]!="proposal_only" or not HASH.fullmatch(seed["id"]):raise ValueError("Invalid seed identity")
    instant=dt.datetime.fromisoformat(seed["created_at"].replace("Z","+00:00"))
    if instant.tzinfo is None:raise ValueError("Missing timestamp zone")
    day=instant.astimezone(dt.timezone.utc).date().isoformat()
    path=root/"days"/(day+".json")
    index=root/"index.json"
    content=json.loads(path.read_text()) if path.exists() else {"schema":SCHEMA,"day":day,"seeds":[]}
    summary=json.loads(index.read_text()) if index.exists() else {"schema":INDEX,"latest_day":None}
    if content.get("schema")!=SCHEMA or content.get("day")!=day or not isinstance(content.get("seeds"),list) or summary.get("schema")!=INDEX:raise ValueError("Archive schema mismatch")
    existing=next((x for x in content["seeds"] if x["id"]==seed["id"]),None)
    if existing:
        if existing!=seed:raise ValueError("Immutable seed collision")
        return False
    if len(content["seeds"])>=288:raise ValueError("Daily archive bound reached")
    content["seeds"].append(seed)
    write_json(path,content)
    write_json(index,{"schema":INDEX,"latest_day":max(day,summary.get("latest_day") or day)})
    return True
