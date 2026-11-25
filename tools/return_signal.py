#!/usr/bin/env python3
"""Return Signal: bounded, actual sample analysis; no AI service, audience claims or broadcast writes."""
import argparse
import base64
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import subprocess
import urllib.request
from urllib.parse import urljoin, urlsplit

ROOT="https://humkin-long-wave.joyvolcanomusic.workers.dev"
PLAYLIST=ROOT+"/hls/live.m3u8"
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

def select_segment(manifest):
    """Use only an exact allowlisted, complete HLS segment; never follow arbitrary URLs."""
    if not manifest.startswith("#EXTM3U"):raise ValueError("Invalid playlist")
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
            url=urljoin(PLAYLIST,line);p=urlsplit(url)
            if p.scheme!="https" or p.netloc!=urlsplit(ROOT).netloc or p.query or p.fragment or not SEGMENT.fullmatch(p.path):
                raise ValueError("Unapproved HLS segment")
            if when is None or when.tzinfo is None or duration is None or not 0.25<=duration<=11:raise ValueError("Incomplete segment")
            d=cue[1] if cue and cue[0]<=when else {}
            rows.append((url,when,clean(d.get("title"),160),clean(d.get("id"),90)))
            when=when+dt.timedelta(seconds=duration);duration=None
    if not rows:raise ValueError("No complete audio segment")
    return rows[-1]

def measure(pcm):
    if len(pcm)%2 or not 16000<=len(pcm)<=16*16000:raise ValueError("Insufficient bounded audio")
    samples=[v[0]/32768 for v in struct.iter_unpack("<h",pcm)]
    rms=math.sqrt(sum(v*v for v in samples)/len(samples))
    peak=max(abs(v) for v in samples)
    db=lambda x:round(20*math.log10(max(x,1e-6)),1)
    return {"sample_seconds":round(len(samples)/8000,2),"rms_dbfs":db(rms),"peak_dbfs":db(peak)}

def capture(now=None,fetch=get):
    now=now or dt.datetime.now(dt.timezone.utc)
    url,when,title,track=select_segment(fetch(PLAYLIST,256000).decode("utf-8"))
    age=(now-when).total_seconds()
    if not -30<=age<=90:raise ValueError("Stale audio sample")
    raw=fetch(url,3*1024*1024)
    result=subprocess.run(["ffmpeg","-nostdin","-v","error","-f","mpegts","-i","pipe:0","-map","0:a:0","-t","8","-ac","1","-ar","8000","-f","s16le","pipe:1"],input=raw,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=15,check=True)
    metrics=measure(result.stdout)
    ident=hashlib.sha256(("signal-ear/v1:"+url).encode()).hexdigest()
    return {"id":ident,"agent":"SIGNAL EAR","basis":"audio","station_id":"station-one","observed_at":now.isoformat(),"media_at":when.isoformat(),"track_title":title,"recording_id":track,"response":f"Decoded {metrics['sample_seconds']:.2f} seconds of broadcast audio. RMS {metrics['rms_dbfs']:.1f} dBFS; peak {metrics['peak_dbfs']:.1f} dBFS. A measured fragment, not a full-song interpretation.","metrics":metrics,"method":"ffmpeg-pcm-levels/v1"}

def append(feed,entry):
    if feed.get("schema")!=SCHEMA or not isinstance(feed.get("entries"),list) or len(feed["entries"])>64:raise ValueError("Invalid feed")
    if any(x["id"]==entry["id"] for x in feed["entries"]):return feed
    return {"schema":SCHEMA,"entries":[entry,*feed["entries"]][:64]}

def main():
    p=argparse.ArgumentParser();p.add_argument("--feed",type=Path,required=True);args=p.parse_args()
    feed=json.loads(args.feed.read_text())
    try:entry=capture()
    except (ValueError,OSError,subprocess.SubprocessError) as e:
        print("No verified sample; no new response:",type(e).__name__);return
    updated=append(feed,entry)
    if updated!=feed:
        args.feed.write_text(json.dumps(updated,indent=2,ensure_ascii=False)+"\n")
        print("One verified audio observation prepared.")
if __name__=="__main__":main()
