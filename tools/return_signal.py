#!/usr/bin/env python3
"""Return Signal: bounded, actual sample analysis; no AI service, audience claims or broadcast writes."""
import argparse
import base64
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import struct
import io
import wave
import subprocess
import urllib.request
from urllib.parse import urljoin, urlsplit

ROOT="https://humkin-long-wave.joyvolcanomusic.workers.dev"
PLAYLIST=ROOT+"/hls/live.m3u8"
CLOUD_PLAYLIST=ROOT+"/autopilot/station-one/live.m3u8"
CLOUD_SEGMENT=re.compile(r"/autopilot/station-one/segments/[a-f0-9]{64}/segment-[0-9]{6}\.ts\Z")
SCHEMA="humkin.return-signal/v1"
SEGMENT=re.compile(r"/hls/(?:station-one/)?[a-f0-9]{32}/segment-[0-9]{10,16}\.ts\Z")
CUE=re.compile(r'^#EXT-X-DATERANGE:ID="[^"]+",CLASS="org\.abundent\.humkin\.track",START-DATE="([^"]+)",X-HUMKIN="([A-Za-z0-9_-]{1,5000})"$')
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise ValueError("Redirect not allowed")

def get(url,limit):
    with urllib.request.build_opener(NoRedirect()).open(urllib.request.Request(url,headers={"User-Agent":"HUMKIN-Return-Signal/1.0"}),timeout=12) as response:
        if response.status != 200: raise ValueError("Broadcast unavailable")
        data=response.read(limit+1)
        if len(data)>limit:raise ValueError("Sample too large")
        return data

def clean(value,limit):
    return " ".join(value.split())[:limit] if isinstance(value,str) else ""

def select_segment(manifest,playlist=PLAYLIST):
    """Use only an exact allowlisted, complete HLS segment; never follow arbitrary URLs."""
    if not manifest.startswith("#EXTM3U"):raise ValueError("Invalid playlist")
    if playlist not in (PLAYLIST,CLOUD_PLAYLIST):raise ValueError("Invalid playlist source")
    allowed=SEGMENT if playlist==PLAYLIST else CLOUD_SEGMENT
    rows=[];cue=None;when=None;duration=None
    for line in manifest.splitlines():
        m=CUE.fullmatch(line)
        if m:
            try:
                stamp=dt.datetime.fromisoformat(m[1].replace("Z","+00:00"))
                d=json.loads(base64.urlsafe_b64decode(m[2]+"="*(-len(m[2])%4)))
                cue=(stamp,d) if isinstance(d,dict) else None
            except (ValueError,TypeError):cue=None
        elif line.startswith("#EXT-X-PROGRAM-DATE-TIME:"):
            when=dt.datetime.fromisoformat(line.split(":",1)[1].replace("Z","+00:00"))
        elif line.startswith("#EXTINF:"):
            duration=float(line.split(":",1)[1].split(",")[0])
        elif line and not line.startswith("#"):
            url=urljoin(playlist,line);p=urlsplit(url)
            if p.scheme!="https" or p.netloc!=urlsplit(ROOT).netloc or p.query or p.fragment or not allowed.fullmatch(p.path):
                raise ValueError("Unapproved HLS segment")
            if when is None or when.tzinfo is None or duration is None or not 0.25<=duration<=11:raise ValueError("Incomplete segment")
            d=cue[1] if cue and cue[0]<=when else {}
            rows.append((url,when,clean(d.get("title"),160),clean(d.get("id"),90)))
            when=when+dt.timedelta(seconds=duration);duration=None
    if not rows:raise ValueError("No complete audio segment")
    return rows[-1]

def measure(pcm,sample_rate=8000):
    if len(pcm)%2 or not 2*sample_rate<=len(pcm)<=16*sample_rate:raise ValueError("Insufficient bounded audio")
    samples=[v[0]/32768 for v in struct.iter_unpack("<h",pcm)]
    rms=math.sqrt(sum(v*v for v in samples)/len(samples))
    peak=max(abs(v) for v in samples)
    db=lambda x:round(20*math.log10(max(x,1e-6)),1)
    return {"sample_seconds":round(len(samples)/sample_rate,2),"rms_dbfs":db(rms),"peak_dbfs":db(peak)}

def capture(now=None,fetch=get,with_audio=False):
    now=now or dt.datetime.now(dt.timezone.utc)
    for playlist,transport in ((PLAYLIST,"hot_hls"),(CLOUD_PLAYLIST,"cloud_autopilot_hls")):
        try:
            url,when,title,track=select_segment(fetch(playlist,256000).decode("utf-8"),playlist)
            age=(now-when).total_seconds()
            if not -30<=age<=90:raise ValueError("Stale audio sample")
            raw=fetch(url,3*1024*1024)
            break
        except (ValueError,OSError,TypeError):
            continue
    else:raise ValueError("Neither approved Station One transport supplied a fresh sample")
    result=subprocess.run(["ffmpeg","-nostdin","-v","error","-f","mpegts","-i","pipe:0","-map","0:a:0","-t","8","-ac","2","-ar","44100","-f","s16le","pipe:1"],input=raw,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=15,check=True)
    pcm=result.stdout
    if len(pcm)%4 or not 176400<=len(pcm)<=1411200:raise ValueError("Invalid bounded stereo sample")
    # Measure a bounded mono representation from the same decoded stereo sample.
    mono=bytearray()
    for i in range(0,len(pcm),24):
        left,right=struct.unpack_from("<hh",pcm,i)
        mono.extend(struct.pack("<h",round((left+right)/2)))
    metrics=measure(bytes(mono), sample_rate=7350)
    ident=hashlib.sha256(("signal-ear/v2:"+url+":"+when.isoformat()).encode()).hexdigest()
    entry={"id":ident,"agent":"SIGNAL EAR","basis":"audio","station_id":"station-one","transport":transport,"observed_at":now.isoformat(),"media_at":when.isoformat(),"track_title":title,"recording_id":track,"response":f"Decoded {metrics['sample_seconds']:.2f} seconds of broadcast audio. RMS {metrics['rms_dbfs']:.1f} dBFS; peak {metrics['peak_dbfs']:.1f} dBFS. A measured fragment, not a full-song interpretation.","metrics":metrics,"segment_sha256":hashlib.sha256(raw).hexdigest(),"method":"ffmpeg-pcm-levels/v2-stereo-downsample"}
    if not with_audio:return entry
    carrier=io.BytesIO()
    with wave.open(carrier,"wb") as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(44100);w.writeframes(pcm)
    return entry,carrier.getvalue()

def append(feed,entry):
    if feed.get("schema")!=SCHEMA or not isinstance(feed.get("entries"),list) or len(feed["entries"])>64:raise ValueError("Invalid feed")
    if any(x["id"]==entry["id"] for x in feed["entries"]):return feed
    return {"schema":SCHEMA,"entries":[entry,*feed["entries"]][:64]}

def reviewed_response(feed, source_id, agent, basis, response, now=None):
    """Publish an operator-reviewed interpretation tied to a real received sample."""
    if agent not in {"MOTIF","HAUNTED TOASTER","reLATTE","MEMENTO","Dr. MADDcl0wn","JAR;VIS"}:
        raise ValueError("Unknown internal correspondent")
    if basis not in {"metadata","creative"}:
        raise ValueError("Only interpretation modes accepted by this review adapter")
    if not isinstance(response,str) or not 1<=len(response.strip())<=420 or any(ord(c)<32 for c in response):
        raise ValueError("Response must be one bounded plain-text statement")
    source=next((x for x in feed["entries"] if x.get("id")==source_id and x.get("basis")=="audio" and x.get("agent")=="SIGNAL EAR"),None)
    if source is None:
        raise ValueError("Choose an existing received audio sample")
    now=now or dt.datetime.now(dt.timezone.utc)
    response=response.strip()
    key=json.dumps([source_id,agent,basis,response],ensure_ascii=False,separators=(",",":"))
    return {"id":hashlib.sha256(key.encode()).hexdigest(),"agent":agent,
            "basis":basis,"station_id":"station-one","observed_at":now.isoformat(),
            "media_at":source["media_at"],"track_title":source["track_title"],
            "recording_id":source["recording_id"],"response":response,
            "source_sample_id":source_id,"method":"operator-reviewed-agent-correspondence/v1",
            "review":"operator-reviewed; agent attribution supplied by operator"}

def main():
    p=argparse.ArgumentParser();p.add_argument("--feed",type=Path,required=True);args=p.parse_args()
    feed=json.loads(args.feed.read_text())
    if os.environ.get("RETURN_SIGNAL_MODE")=="reviewed":
        if os.environ.get("RETURN_SIGNAL_APPROVED")!="true":
            raise ValueError("Explicit review approval required")
        entry=reviewed_response(feed,os.environ.get("RETURN_SIGNAL_SOURCE"),os.environ.get("RETURN_SIGNAL_AGENT"),os.environ.get("RETURN_SIGNAL_BASIS"),os.environ.get("RETURN_SIGNAL_TEXT"))
    else:
        try:entry,carrier=capture(with_audio=True)
        except (ValueError,OSError,subprocess.SubprocessError) as e:
            print("No verified sample; no new response:",type(e).__name__);return
    updated=append(feed,entry)
    if os.environ.get("RETURN_SIGNAL_MODE")!="reviewed" and updated!=feed:
        from listening_council import council
        from echo_orchard import archive,seed_from
        for response in council(entry,carrier,feed):
            if response.get("method")=="haunted-phonograph/field-answer-v0":
                seed=seed_from(response,entry)
                archive(args.feed.parent/"echo-orchard",seed)
                response=dict(response,proposal={k:v for k,v in response["proposal"].items() if k not in ("midi","native_receipt","native_proposal","signal_evidence")},echo_seed_id=seed["id"],echo_day=seed["created_at"][:10])
            updated=append(updated,response)
    if updated!=feed:
        args.feed.write_text(json.dumps(updated,indent=2,ensure_ascii=False)+"\n")
        print("One verified audio observation prepared.")
if __name__=="__main__":main()
