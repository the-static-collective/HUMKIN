"""Bounded native council: one actual musical response and one evidence relation.
No public write endpoints, paid models, private source lookup or broadcast actions.
"""
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import subprocess

PIN="f5709e096756055e1a28c95ac5f9e79873319631"
BRIDGE=Path(__file__).resolve().parent/"listening-council/field-answer-bridge.mjs"
HASH=re.compile(r"(?:sha256:)?[a-f0-9]{64}\Z")

def entry(source,agent,basis,response,method,extra):
    ident=hashlib.sha256(json.dumps([source["id"],agent,method],separators=(",",":")).encode()).hexdigest()
    return {"id":ident,"agent":agent,"basis":basis,"station_id":"station-one",
            "observed_at":source["observed_at"],"media_at":source["media_at"],
            "track_title":source["track_title"],"recording_id":source["recording_id"],
            "response":response,"source_sample_id":source["id"],"method":method,
            "review":"automatic bounded engine",**extra}

def field_answer(source,carrier,runner=subprocess.run):
    segment=source.get("segment_sha256","")
    if not re.fullmatch(r"[a-f0-9]{64}",segment):raise ValueError("Missing actual source segment digest")
    result=runner(["node",str(BRIDGE),source["id"],segment],input=carrier,stdout=subprocess.PIPE,
                  stderr=subprocess.DEVNULL,timeout=20,check=True)
    if len(result.stdout)>8192:raise ValueError("Field answer output exceeds bound")
    data=json.loads(result.stdout)
    notes=data["pitches"];tempo=data["tempo_bpm"];durations=data["durations_quarter"]
    if not isinstance(notes,list) or len(notes)!=4 or any(type(n) is not int or not 36<=n<=84 for n in notes):raise ValueError("Invalid pitches")
    if type(tempo) is not int or not 76<=tempo<=116:raise ValueError("Invalid tempo")
    if not isinstance(durations,list) or len(durations)!=4 or any(d not in (.5,.75,1) for d in durations):raise ValueError("Invalid duration")
    if data.get("source_audio_sha256")!=hashlib.sha256(carrier).hexdigest():raise ValueError("Returned audio digest mismatch")
    for key in ("receipt_hash","signal_evidence_hash","proposal_hash","source_audio_sha256"):
        if not isinstance(data[key],str) or not HASH.fullmatch(data[key]):raise ValueError("Invalid receipt")
    names=("C","C#","D","D#","E","F","F#","G","G#","A","A#","B")
    melody=" – ".join(names[n%12]+str(n//12-1) for n in notes)
    return entry(source,"HAUNTED PHONOGRAPHY","creative",
        f"Musical reply: {melody}, proposed at {tempo} BPM. Generated from the sampled energy contour; these are new notes, not transcribed pitches.",
        "haunted-phonograph/field-answer-v0",{"engine_commit":PIN,"proposal":data})

def relation(source,feed):
    # reLATTE-inspired identity/evidence seam; not a claim that its full runtime executed.
    recording=source.get("recording_id")
    if not recording:return None
    matches=[r for r in feed["entries"] if r.get("agent")=="SIGNAL EAR" and r.get("basis")=="audio"
             and r.get("recording_id")==recording and r.get("id")!=source["id"]]
    if not matches:return None
    other=matches[0]
    return entry(source,"RELATION LENS","metadata",
        "This recording identity has appeared in another retained broadcast sample. A shared catalog identity, not an acoustic similarity judgment.",
        "relatte-inspired-recording-relation/v1",{"related_sample_id":other["id"],"engine_commit":"d2f18b0a26d177c76ebfe45edcf93aa60c10fd49"})

def council(source,carrier,feed):
    if source.get("agent")!="SIGNAL EAR" or source.get("basis")!="audio" or not HASH.fullmatch(source.get("id","")):
        return []
    out=[]
    try:out.append(field_answer(source,carrier))
    except (OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError):
        print("Field Answer unavailable; no invented reply.")
    related=relation(source,feed)
    if related:out.append(related)
    return out[:2]
