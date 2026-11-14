#!/usr/bin/env python3
"""HUMKIN Radio broadcast-source prototype. Python 3.9+, FFmpeg required.

Outputs ONE continuous encoded MP3 stream to Icecast; it never restarts the
source connection between songs. No password or user data is committed.
Run --dry-run --fixture FILE first. See README.md before broadcasting.
"""
import argparse
import array
import hashlib
import json
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

API="https://kbhqacsdvjsstzyplqij.supabase.co"
KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o"
RADIO="https://humkin.abundent.org/fm/"
ZONE=ZoneInfo("America/Chicago")
RATE=44100
CHANNELS=2
FRAME_BYTES=4
MAX_DOWNLOAD=65*1024*1024

def get_json(url,api=False):
    headers={"User-Agent":"HUMKIN-BroadcastKit/0.1"}
    if api:headers["apikey"]=KEY
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=15) as r:
        return json.load(r)

def live_catalog():
    base=get_json(RADIO+"rotation.json")
    static_overrides=get_json(API+"/rest/v1/humkin_radio_static_overrides?select=track_id,title,artist,album,kind,enabled&limit=1000",True)
    cloud=get_json(API+"/rest/v1/humkin_radio_tracks?select=id,title,artist,album,kind,enabled,duration_seconds,storage_path&published_at=not.is.null&enabled=eq.true&limit=1000",True)
    shows=get_json(API+"/rest/v1/humkin_radio_programs?select=id,name,days,start_minute,end_minute,track_ids,is_active,priority&is_active=eq.true&limit=100",True)
    settings=get_json(API+"/rest/v1/humkin_radio_settings?select=bumper_every,station_label&id=eq.main&limit=1",True)
    overrides={o["track_id"]:o for o in static_overrides}
    tracks=[]
    for t in base.get("tracks",[]):
        o=overrides.get(t["id"],{})
        if o.get("enabled") is False:continue
        tracks.append(dict(id=t["id"],title=o.get("title") or t["title"],
                           artist=o.get("artist") or t.get("artist","HUMKIN"),
                           kind=o.get("kind","song"),
                           duration=float(t["duration"]),
                           url=urllib.parse.urljoin(RADIO,t["src"])))
    for t in cloud:
        path=t.get("storage_path","")
        if not (isinstance(path,str) and len(path.split("/"))==2 and path.endswith(".mp3")):continue
        if not t.get("enabled",True):continue
        tracks.append(dict(id="crate-"+t["id"],title=t.get("title","Untitled"),
                           artist=t.get("artist","HUMKIN"),kind=t.get("kind","song"),
                           duration=float(t["duration_seconds"]),
                           url=API+"/storage/v1/object/public/humkin-radio-live/"+path))
    return {"tracks":tracks,"shows":shows,"settings":settings[0] if settings else {"bumper_every":0}}

class Station:
    def __init__(self,catalog,seed=2026):
        self.random=random.Random(seed)
        self.catalog=catalog
        self.track_by_id={t["id"]:t for t in catalog["tracks"] if t.get("duration",0)>0}
        self.song_ids=[t["id"] for t in catalog["tracks"] if t.get("kind")!="bumper" and t.get("duration",0)>0]
        self.bumper_ids=[t["id"] for t in catalog["tracks"] if t.get("kind")=="bumper" and t.get("duration",0)>0]
        self.music_order=[]
        self.music_cursor=0
        self.music_since_id=0
        self.bumper_cursor=0
        self.current_show=None
        self.show_cursor=0
    def program(self,when=None):
        when=(when or datetime.now(timezone.utc)).astimezone(ZONE)
        day=(when.weekday()+1)%7  # Sunday=0, matching web scheduler.
        minute=when.hour*60+when.minute
        eligible=[p for p in self.catalog.get("shows",[])
                  if p.get("is_active",False)
                  and day in p.get("days",[])
                  and int(p.get("start_minute",0))<=minute<int(p.get("end_minute",0))
                  and any(t in self.track_by_id for t in p.get("track_ids",[]))]
        eligible.sort(key=lambda x:(-int(x.get("priority",0)),
                                    -int(x.get("start_minute",0)),str(x.get("id",""))))
        return eligible[0] if eligible else None
    def next(self,when=None):
        show=self.program(when)
        if show:
            if self.current_show!=show["id"]:
                self.current_show=show["id"];self.show_cursor=0
            valid=[x for x in show.get("track_ids",[]) if x in self.track_by_id]
            if valid:
                item=self.track_by_id[valid[self.show_cursor%len(valid)]]
                self.show_cursor+=1;return item
        self.current_show=None
        every=int(self.catalog.get("settings",{}).get("bumper_every",0) or 0)
        if not (1<=every<=20):every=0
        if every and self.bumper_ids and self.music_since_id>=every:
            item=self.track_by_id[self.bumper_ids[self.bumper_cursor%len(self.bumper_ids)]]
            self.bumper_cursor+=1;self.music_since_id=0;return item
        if self.music_cursor>=len(self.music_order):
            self.music_order=list(self.song_ids)
            self.random.shuffle(self.music_order)
            self.music_cursor=0
        if not self.music_order:raise RuntimeError("No enabled published songs available")
        item=self.track_by_id[self.music_order[self.music_cursor]]
        self.music_cursor+=1;self.music_since_id+=1
        return item

def cache_track(item,cache):
    cache.mkdir(parents=True,exist_ok=True)
    url=str(item["url"])
    if not url.startswith(("https://humkin.abundent.org/","https://kbhqacsdvjsstzyplqij.supabase.co/storage/v1/object/public/humkin-radio-live/")):
        raise ValueError("Track URL is outside approved audio origins")
    name=hashlib.sha256(url.encode()).hexdigest()+".mp3"
    final=cache/name
    if final.is_file() and final.stat().st_size>1000:return final
    with tempfile.NamedTemporaryFile(dir=cache,delete=False,suffix=".part") as temp:
        tmp=Path(temp.name)
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"HUMKIN-BroadcastKit/0.1"}),timeout=25) as response:
                total=0
                while True:
                    chunk=response.read(65536)
                    if not chunk:break
                    total+=len(chunk)
                    if total>MAX_DOWNLOAD:raise ValueError("Audio file exceeds safe 65 MiB limit")
                    temp.write(chunk)
            if total<1000:raise ValueError("Empty audio download")
            temp.flush();os.fsync(temp.fileno())
            tmp.replace(final)
        finally:
            if tmp.exists():tmp.unlink()
    return final

def decode(path):
    return subprocess.Popen(["ffmpeg","-nostdin","-hide_banner","-loglevel","error",
                             "-i",str(path),"-vn","-ar",str(RATE),"-ac","2",
                             "-f","s16le","pipe:1"],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)

def read_exact(stream,n):
    result=bytearray()
    while len(result)<n:
        block=stream.read(n-len(result))
        if not block:break
        result.extend(block)
    return bytes(result[:len(result)//FRAME_BYTES*FRAME_BYTES])

def pump_with_tail(process,write,reserved):
    # Only the end stays in memory. Previously decoded audio flows continuously
    # through a single FFmpeg/Icecast encoder, even between track boundaries.
    buffer=bytearray()
    while True:
        chunk=process.stdout.read(65536)
        if not chunk:break
        buffer.extend(chunk)
        count=max(0,len(buffer)-reserved)
        count-=count%FRAME_BYTES
        if count:
            write(bytes(buffer[:count]))
            del buffer[:count]
    process.stdout.close()
    process.wait(timeout=15)
    return bytes(buffer)

def overlap_bytes(one,two,seconds):
    # With very short spoken IDs, keep fades smaller than 1/4 of either file.
    secs=min(max(0.0,seconds),float(one.get("duration",0))/4,
             float(two.get("duration",0))/4)
    frames=max(0,int(secs*RATE))
    return frames*FRAME_BYTES

def equal_power_mix(a,b):
    count=min(len(a),len(b))//FRAME_BYTES*FRAME_BYTES
    if count<=0:return b""
    left=array.array("h");left.frombytes(a[-count:])
    right=array.array("h");right.frombytes(b[:count])
    if sys.byteorder!="little":
        left.byteswap();right.byteswap()
    frames=count//FRAME_BYTES
    out=array.array("h",[0])*len(left)
    for frame in range(frames):
        theta=(frame/max(1,frames-1))*math.pi/2
        x=math.cos(theta);y=math.sin(theta)
        for channel in range(CHANNELS):
            idx=frame*CHANNELS+channel
            sample=round(left[idx]*x+right[idx]*y)
            out[idx]=max(-32768,min(32767,sample))
    if sys.byteorder!="little":out.byteswap()
    return out.tobytes()

def output_process(destination,bitrate):
    return subprocess.Popen([
      "ffmpeg","-nostdin","-hide_banner","-loglevel","warning",
      "-re","-f","s16le","-ar",str(RATE),"-ac","2","-i","pipe:0",
      "-af","dynaudnorm=f=250:g=15:p=0.9",
      "-codec:a","libmp3lame","-b:a",str(bitrate)+"k",
      "-content_type","audio/mpeg","-f","mp3",destination
    ],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL)

def streaming(catalog,args):
    if not shutil.which("ffmpeg"):raise RuntimeError("FFmpeg must be installed")
    url=args.icecast_url or os.environ.get("HUMKIN_ICECAST_URL")
    if not url and not args.file_output:raise RuntimeError("Set HUMKIN_ICECAST_URL (secret) or --file-output")
    if args.file_output and args.seconds<=0:raise RuntimeError("--file-output requires --seconds, to avoid unlimited file growth")
    output=str(args.file_output) if args.file_output else url
    if not args.file_output and not output.startswith("icecast://"):
        raise RuntimeError("HUMKIN_ICECAST_URL must start with icecast://")
    station=Station(catalog)
    cache=Path(args.cache).expanduser().resolve()
    encoder=output_process(output,args.bitrate)
    written=0
    maximum=int(args.seconds*RATE*FRAME_BYTES) if args.seconds else None
    def write(chunk):
        nonlocal written
        if not chunk:return
        if maximum is not None:
            chunk=chunk[:max(0,maximum-written)]
            chunk=chunk[:len(chunk)//FRAME_BYTES*FRAME_BYTES]
        if chunk:
            if encoder.poll() is not None:raise RuntimeError("Encoder/Icecast source disconnected; see FFmpeg errors")
            encoder.stdin.write(chunk);written+=len(chunk)
        if maximum is not None and written>=maximum:raise StopIteration()
    try:
        current=station.next()
        ahead=station.next()
        decode_current=decode(cache_track(current,cache))
        while True:
            print("ON AIR:",current["artist"],"—",current["title"],flush=True)
            tail_size=overlap_bytes(current,ahead,args.crossfade)
            try:
                tail=pump_with_tail(decode_current,write,tail_size)
                head_process=decode(cache_track(ahead,cache))
                head=read_exact(head_process.stdout,tail_size)
                n=min(len(head),len(tail))//FRAME_BYTES*FRAME_BYTES
                if n:
                    write(tail[:-n])
                    write(equal_power_mix(tail[-n:],head[:n]))
                else:write(tail)
                # If decoder reads less than requested, no source data is dropped.
                current=ahead
                ahead=station.next()
                decode_current=head_process
            except (OSError,ValueError,subprocess.SubprocessError) as exc:
                print("Audio source problem; moving on:",exc,file=sys.stderr)
                if 'head_process' in locals() and head_process.poll() is None:
                    head_process.kill();head_process.wait()
                current=ahead
                ahead=station.next()
                decode_current=decode(cache_track(current,cache))
                # Leave the single source connection open across a bad song.
                write(b"\0"*(RATE*FRAME_BYTES))
    except StopIteration:
        print("Local timed broadcast sample complete.",flush=True)
    finally:
        try:encoder.stdin.close()
        except (BrokenPipeError,OSError):pass
        encoder.wait(timeout=45)

def main():
    p=argparse.ArgumentParser(description="HUMKIN always-on audio source; physical server setup required")
    p.add_argument("--dry-run",action="store_true",help="show the next 20 selections; no downloads or publishing")
    p.add_argument("--fixture",type=Path,help="test with a local exported catalog JSON")
    p.add_argument("--at",help="dry-run timestamp (e.g. 2026-11-13T13:30:00+00:00)")
    p.add_argument("--cache",default="./radio-cache",help="local MP3 cache folder")
    p.add_argument("--icecast-url",help="private Icecast source URL; prefer env HUMKIN_ICECAST_URL")
    p.add_argument("--file-output",type=Path,help="local MP3 test output instead of broadcasting")
    p.add_argument("--seconds",type=int,default=0,help="limit local test output duration")
    p.add_argument("--bitrate",type=int,default=128,choices=[96,128,160,192])
    p.add_argument("--crossfade",type=float,default=1.5,help="equal-power crossfade seconds, 0–5")
    args=p.parse_args()
    if not 0<=args.crossfade<=5:p.error("--crossfade must be between 0 and 5")
    if args.fixture:catalog=json.loads(args.fixture.read_text(encoding="utf-8"))
    else:catalog=live_catalog()
    if args.dry_run:
        station=Station(catalog)
        at=datetime.fromisoformat(args.at.replace("Z","+00:00")) if args.at else datetime.now(timezone.utc)
        print("SIMULATED show:",(station.program(at) or {}).get("name","all-music"),"at",at.astimezone(ZONE))
        for n in range(20):
            track=station.next(at)
            print(f"{n+1:02d} {track['kind']:7} {track.get('artist','HUMKIN')} — {track['title']}")
        return
    streaming(catalog,args)
if __name__=="__main__":
    main()
