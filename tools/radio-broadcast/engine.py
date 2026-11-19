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
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from zoneinfo import ZoneInfo
# Also works when imported by tests from an unrelated working directory.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from scheduler_v2 import StationV2
from black_box import BlackBox
from catalog_sources import optional_catalog, r2_public_url
from now_playing import CueSheet
from on_air import Desk, serve
from tower_library import FREQUENCY, TowerLibrary
import re
import threading
import webbrowser

API="https://kbhqacsdvjsstzyplqij.supabase.co"
KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o"
RADIO="https://humkin.abundent.org/fm/"
ZONE=ZoneInfo("America/Chicago")
RATE=44100
CHANNELS=2
FRAME_BYTES=4
MAX_DOWNLOAD=65*1024*1024

def configure_log_output():
    """Never let a song/artist Unicode character crash the audio transmitter.

    The hidden PowerShell background process can inherit Windows cp1252 even
    when the interactive terminal uses UTF-8. Keep its current encoding, but
    escape characters it cannot represent in logs rather than stopping music.
    No catalog titles, artist names, or audio bytes are modified.
    """
    for stream in (sys.stdout, sys.stderr):
        reconfigure=getattr(stream,"reconfigure",None)
        if callable(reconfigure):
            try:
                reconfigure(errors="backslashreplace")
            except (OSError,ValueError,TypeError):
                pass

def get_json(url,api=False):
    headers={"User-Agent":"HUMKIN-BroadcastKit/0.1"}
    if api:headers["apikey"]=KEY
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=15) as r:
        return json.load(r)

def live_catalog():
    base=get_json(RADIO+"rotation.json")
    static_overrides=get_json(API+"/rest/v1/humkin_radio_static_overrides?select=track_id,title,artist,album,kind,enabled,art_asset_id&limit=1000",True)
    cloud=get_json(API+"/rest/v1/humkin_radio_tracks?select=id,title,artist,album,kind,is_single,enabled,duration_seconds,storage_path,storage_provider,r2_object_key,art_asset_id&published_at=not.is.null&enabled=eq.true&order=published_at.asc&limit=1000",True)
    shows=get_json(API+"/rest/v1/humkin_radio_programs?select=id,name,days,start_minute,end_minute,track_ids,is_active,priority&is_active=eq.true&limit=100",True)
    settings=get_json(API+"/rest/v1/humkin_radio_settings?select=bumper_every,station_label,bumper_groups,bumper_rules&id=eq.main&limit=1",True)
    try:
        rows=get_json(API+"/rest/v1/humkin_radio_art_assets?select=id,storage_path&limit=1000",True)
    except (OSError, ValueError):
        rows=[]
    art={row["id"]: API+"/storage/v1/object/public/humkin-radio-art/"+row["storage_path"]
         for row in rows if re.fullmatch(r"[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/[0-9a-f]{64}\.jpg",
                                        row.get("storage_path") or "")}
    overrides={o["track_id"]:o for o in static_overrides}
    tracks=[]
    for t in base.get("tracks",[]):
        o=overrides.get(t["id"],{})
        if o.get("enabled") is False:continue
        tracks.append(dict(id=t["id"],title=o.get("title") or t["title"],
                           artist=o.get("artist") or t.get("artist","HUMKIN"),
                           kind=o.get("kind",t.get("kind","song")),
                           album=o.get("album") or t.get("album",""),source="static",
                           duration=float(t["duration"]),
                           artwork=art.get(o.get("art_asset_id")) or (
                               urllib.parse.urljoin(RADIO,t["artwork"]) if t.get("artwork") else None),
                           url=urllib.parse.urljoin(RADIO,t["src"])))
    for t in cloud:
        # The legacy storage_path remains an identity/integrity key even when
        # the actual file has migrated to Cloudflare R2.
        path=t.get("storage_path","")
        if not isinstance(path,str) or not re.fullmatch(r"[0-9a-f-]{36}/[0-9a-f]{64}\.mp3",path):continue
        if not t.get("enabled",True):continue
        duration=float(t.get("duration_seconds") or 0)
        if not 0<duration<14400:continue
        backend="r2" if t.get("storage_provider")=="r2" else "supabase"
        if backend=="r2":
            url=r2_public_url(t.get("r2_object_key"))
        else:
            url=API+"/storage/v1/object/public/humkin-radio-live/"+path
        # A missing or invalid R2 key must NEVER silently fall back to the
        # deleted Supabase bucket, accidentally removing music mid-broadcast.
        if not url:continue
        kind="bumper" if t.get("kind")=="bumper" else "song"
        tracks.append(dict(id="crate-"+t["id"],title=t.get("title","Untitled"),
                           artist=t.get("artist","HUMKIN"),kind=kind,
                           album="HUMKIN RADIO · STATION BUMPERS" if kind=="bumper" else (t.get("album") or "HUMKIN RADIO"),
                           source="cloud",storage_provider=backend,
                           is_single=(kind!="bumper" and t.get("is_single") is True),
                           duration=duration,url=url,artwork=art.get(t.get("art_asset_id"))))
    extras,chart_ids=optional_catalog(get_json,RADIO,API)
    known={t["id"] for t in tracks}
    for item in extras:
        if item["id"] in known:continue
        if item.get("source")=="static":
            o=overrides.get(item["id"],{})
            if o.get("enabled") is False:continue
            item.update(title=o.get("title") or item["title"],
                        artist=o.get("artist") or item["artist"],
                        album=o.get("album") or item["album"],
                        kind=o.get("kind",item["kind"]),artwork=art.get(o.get("art_asset_id")))
        tracks.append(item);known.add(item["id"])
    return {"tracks":tracks,"shows":shows,"settings":settings[0] if settings else {"bumper_every":0},
            "rotation":base,"chart_ids":chart_ids,"policy_version":2}

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
    if item.get("local_audio"):
        return Path(item["local_audio"])
    cache.mkdir(parents=True,exist_ok=True)
    url=str(item["url"])
    if not url.startswith(("https://humkin.abundent.org/","https://kbhqacsdvjsstzyplqij.supabase.co/storage/v1/object/public/humkin-radio-live/","https://media.abundent.org/")):
        raise ValueError("Track URL is outside approved audio origins")
    name=hashlib.sha256(url.encode()).hexdigest()+".mp3"
    final=cache/name
    if final.is_file() and final.stat().st_size>1000:return final
    tmp=None
    try:
        # Close the temporary MP3 *before* renaming it. On Windows,
        # NamedTemporaryFile holds an exclusive handle, so os.replace and
        # unlink raise WinError 32 while this with-block is still open.
        with tempfile.NamedTemporaryFile(dir=cache,delete=False,suffix=".part") as temp:
            tmp=Path(temp.name)
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
        # This is intentionally OUTSIDE the with: Windows has closed the handle.
        tmp.replace(final)
    finally:
        if tmp is not None:
            try:tmp.unlink(missing_ok=True)
            except OSError:pass  # Never obscure the original download/rename error.
    return final

def decode(path):
    return subprocess.Popen(["ffmpeg","-nostdin","-hide_banner","-loglevel","error",
                             "-protocol_whitelist","file,pipe","-i",str(path),"-vn","-ar",str(RATE),"-ac","2",
                             "-f","s16le","pipe:1"],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)

def read_exact(stream,n):
    result=bytearray()
    while len(result)<n:
        block=stream.read(n-len(result))
        if not block:break
        result.extend(block)
    return bytes(result[:len(result)//FRAME_BYTES*FRAME_BYTES])

def pump_with_tail(process,write,reserved,interrupt=None):
    # Only the end stays in memory. Previously decoded audio flows continuously
    # through a single FFmpeg/Icecast encoder, even between track boundaries.
    buffer=bytearray()
    while True:
        chunk=process.stdout.read(65536)
        if not chunk:break
        buffer.extend(chunk)
        count=max(0,len(buffer)-reserved)
        count-=count%FRAME_BYTES
        if interrupt and len(buffer) >= reserved and interrupt():
            break
        if count:
            write(bytes(buffer[:count]))
            del buffer[:count]
    if interrupt and process.poll() is None:
        process.kill()
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

def output_process(destination,bitrate,realtime=True,hls_dir=None,hls_start=None):
    if hls_dir:
        # A local HLS encoder; the separate publisher uploads COMPLETE segments.
        # MPEG-TS/AAC is broadly compatible with standard HLS receivers.
        target=Path(hls_dir).expanduser().resolve()
        target.mkdir(parents=True,exist_ok=True)
        inputs=(["-re"] if realtime else [])+[
          "-f","s16le","-ar",str(RATE),"-ac","2","-i","pipe:0"]
        return subprocess.Popen([
          "ffmpeg","-nostdin","-hide_banner","-loglevel","warning","-y",
          *inputs,"-af","dynaudnorm=f=250:g=15:p=0.9",
          "-codec:a","aac","-b:a",str(bitrate)+"k",
          "-f","hls","-hls_segment_type","mpegts",
          "-hls_time","10","-hls_list_size","12",
          "-hls_delete_threshold","12",
          "-hls_flags","delete_segments+temp_file+program_date_time+omit_endlist",
          "-start_number",str(hls_start if hls_start is not None else int(time.time())),
          "-hls_segment_filename",str(target/"segment-%012d.ts"),
          str(target/"index.m3u8")
        ],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL)
    # -re limits the feed to real time for Icecast. An on-demand file render
    # must run as fast as CPU permits, especially on billed cloud compute.
    inputs=(["-re"] if realtime else [])+[
      "-f","s16le","-ar",str(RATE),"-ac","2","-i","pipe:0"]
    return subprocess.Popen([
      "ffmpeg","-nostdin","-hide_banner","-loglevel","warning",
      # FFmpeg defaults to declining an existing filename. A previous failed
      # preview can leave station-one-preview.mp3 behind; on Windows this makes
      # every subsequent test exit immediately instead of producing audio.
      # Overwrite ONLY explicitly requested local file previews.
      *([] if destination.startswith("icecast://") else ["-y"]),
      *inputs,
      "-af","dynaudnorm=f=250:g=15:p=0.9",
      "-codec:a","libmp3lame","-b:a",str(bitrate)+"k",
      "-content_type","audio/mpeg",
      # Use FFmpeg's encrypted Icecast source connection; fail closed if TLS
      # is not supported by the host. Source URL is visible to local admins
      # through FFmpeg argv, so restrict workstation access.
      *(["-tls","1","-ice_name","HUMKIN RADIO"] if destination.startswith("icecast://") else []),
      "-f","mp3",destination
    ],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,
      # Local preview failures must be visible to diagnose codec/file locks.
      # NEVER echo source ingest URL / credentials from Icecast stderr.
      stderr=(subprocess.DEVNULL if destination.startswith("icecast://") else None))

def controlled_playout(desk, cache, write, crossfade, trace, cue=lambda _: None):
    """Feed the existing encoder from the scheduler's current committed slots."""
    pool = ThreadPoolExecutor(max_workers=3)
    downloads = {}
    decoder = None
    replacement = None

    def prepare():
        # Keep a few real scheduler slots warm, including alternatives after
        # an operator holds or moves the front slot.
        pending = desk.pending(3)
        wanted = {id_ for _, id_ in pending}
        for id_ in list(downloads):
            if id_ not in wanted and (downloads[id_].done() or downloads[id_].cancel()):
                del downloads[id_]
        for id_ in wanted:
            if id_ not in downloads:
                downloads[id_] = pool.submit(cache_track, desk.station.by_id[id_], cache)
        with desk.lock:
            desk.ready = (pending[0][1] if pending and downloads[pending[0][1]].done()
                          else None)
        return pending

    def successor(current, reserve):
        pending = prepare()
        if not pending or not downloads[pending[0][1]].done():
            return None
        slot = pending[0]
        id_ = slot[1]
        item = desk.station.by_id[id_]
        process = None
        try:
            process = decode(downloads[id_].result())
            overlap = overlap_bytes(current, item, crossfade) if current else 0
            # Prove there is audio before interrupting an active recording.
            head = read_exact(process.stdout, max(overlap, FRAME_BYTES))
            if not head:
                raise ValueError("Empty audio decoder output")
        except (OSError, ValueError, subprocess.SubprocessError):
            close_decoder(process)
            desk.fail(id_)
            trace("audio_error", {"mode": "stream", "track_id": id_, "reason": "source_error"})
            print("Unavailable audio:", item["title"], file=sys.stderr)
            return None
        if not desk.start(slot):
            close_decoder(process)
            return None
        return process, head, min(reserve, overlap)

    def close_decoder(process):
        if process is None:
            return
        if process.poll() is None:
            process.kill()
        process.stdout.close()
        process.wait(timeout=5)

    try:
        while replacement is None:
            replacement = successor(None, 0)
            if replacement is None:
                if not desk.pending(1):
                    raise RuntimeError("No available audio to start the source")
                time.sleep(.05)
        decoder, head, _ = replacement
        replacement = None
        cue(desk.current)
        write(head)
        while True:
            current = desk.current
            trace("source_select", {"mode": "stream", "track_id": current["id"],
                                   "kind": current.get("kind", "song"), "reason": "automatic"})
            print("ON AIR:", current["artist"], "—", current["title"], flush=True)
            reserve = overlap_bytes(current, current, crossfade)

            def interrupt():
                nonlocal replacement
                prepare()
                if desk.skip:
                    replacement = successor(current, reserve)
                return replacement is not None

            tail = pump_with_tail(decoder, write, reserve, interrupt)
            decoder = None
            skipped = replacement is not None
            if replacement is None:
                replacement = successor(current, reserve)
            if replacement is None:
                write(tail)
                tail = b""
                cue(None)
                # Use the same encoder even if the operator changes to an
                # uncached recording at the boundary.
                while replacement is None:
                    write(b"\0" * (RATE * FRAME_BYTES // 10))
                    replacement = successor(current, 0)
            decoder, head, overlap = replacement
            replacement = None
            n = min(len(tail), len(head), overlap)
            n = n // FRAME_BYTES * FRAME_BYTES
            if n:
                # For a skip, fade from the first unwritten PCM, which is
                # adjacent to what we just sent to the encoder.
                if not skipped:
                    write(tail[:-n])
                blend = equal_power_mix(tail[:n] if skipped else tail[-n:], head[:n])
                middle = (n // FRAME_BYTES // 2) * FRAME_BYTES
                write(blend[:middle])
                cue(desk.current)
                write(blend[middle:])
            else:
                if not skipped:
                    write(tail)
                cue(desk.current)
            write(head[n:])
            trace("boundary", {"mode": "stream", "track_id": current["id"],
                               "next_track_id": desk.current["id"],
                               "reason": "operator_skip" if skipped else "automatic"})
    finally:
        close_decoder(decoder)
        if replacement is not None:
            close_decoder(replacement[0])
        pool.shutdown(wait=False, cancel_futures=True)


def streaming(catalog,args):
    if not shutil.which("ffmpeg"):raise RuntimeError("FFmpeg must be installed")
    url=args.icecast_url or os.environ.get("HUMKIN_ICECAST_URL")
    if not url and not args.file_output and not args.hls_dir:raise RuntimeError("Set HUMKIN_ICECAST_URL (secret), --file-output, or --hls-dir")
    if args.file_output and args.seconds<=0:raise RuntimeError("--file-output requires --seconds, to avoid unlimited file growth")
    output=str(args.hls_dir) if args.hls_dir else (str(args.file_output) if args.file_output else url)
    if not args.file_output and not args.hls_dir and not output.startswith("icecast://"):
        raise RuntimeError("HUMKIN_ICECAST_URL must start with icecast://")
    station=StationV2(catalog,seed=args.seed if args.seed is not None else int(time.time())) if catalog.get("policy_version")==2 else Station(catalog)
    journal=BlackBox(args.black_box_file) if getattr(args,"black_box_file",None) else None
    def trace(event, detail):
        if journal:
            try:journal.record(event,detail)
            except OSError:pass  # Logging is never allowed to stop the broadcast.
    cache=Path(args.cache).expanduser().resolve()
    tower_root = getattr(args, "tower_root", None)
    control_path = getattr(args, "on_air_state", None)
    frequency = getattr(args, "frequency", "station-one")
    tower = TowerLibrary(tower_root, frequency) if tower_root else None
    if tower:
        control_path = tower.root / (frequency + "-programming.json")
    if control_path and not isinstance(station, StationV2):
        raise ValueError("The on-air dashboard requires a StationV2 catalog")
    desk = Desk(station, control_path, preview=bool(args.file_output), tower=tower) if control_path else None
    server = None
    hls_start = int(time.time())
    encoder=output_process(output,args.bitrate,realtime=bool(desk) or not bool(args.file_output),
                           hls_dir=args.hls_dir,hls_start=hls_start)
    sheet = CueSheet(args.hls_dir, hls_start) if args.hls_dir else None
    written=0
    def cue(item):
        if sheet:
            sheet.record(written / (RATE * FRAME_BYTES), item)
    maximum=int(args.seconds*RATE*FRAME_BYTES) if args.seconds else None
    def write(chunk):
        nonlocal written
        # Cooperative managed stop lets FFmpeg close its current segment and
        # release the temporary playlist before the R2 publisher exits.
        if args.stop_file and args.run_id:
            try:
                if args.stop_file.read_text(encoding="utf-8").strip() == args.run_id:
                    raise StopIteration()
            except (OSError, UnicodeError):
                pass
        if not chunk:return
        if maximum is not None:
            chunk=chunk[:max(0,maximum-written)]
            chunk=chunk[:len(chunk)//FRAME_BYTES*FRAME_BYTES]
        if chunk:
            if encoder.poll() is not None:
                label=("HLS source" if args.hls_dir else ("Icecast source" if not args.file_output else "Local MP3 preview"))
                raise RuntimeError(label+" encoder exited before audio was written; check the FFmpeg error above (for local preview, close any audio player locking the file).")
            encoder.stdin.write(chunk);written+=len(chunk)
        if maximum is not None and written>=maximum:raise StopIteration()
    # Download the NEXT public audio copy while the current recording plays.
    # This avoids blocking the encoder after a crossfade on ordinary cache misses.
    fetch_pool=ThreadPoolExecutor(max_workers=1)
    prepared_decoders=set()
    def prepare_next(item,reserved_bytes):
        # Prefetch *and decode* the opening PCM while the preceding song plays.
        # Previously only the MP3 was downloaded ahead of time. FFmpeg decoder
        # startup then blocked the encoder exactly at the musical boundary.
        process=decode(cache_track(item,cache))
        prepared_decoders.add(process)
        return process,read_exact(process.stdout,reserved_bytes)
    try:
        if desk:
            server, address = serve(desk, args.on_air_port)
            print("HUMKIN Tower:", address, flush=True)
            if args.open_on_air:
                threading.Thread(target=webbrowser.open, args=(address,), daemon=True).start()
            controlled_playout(desk, cache, write, args.crossfade, trace, cue)
            return
        current=station.next()
        ahead=station.next()
        decode_current=decode(cache_track(current,cache))
        cue(current)
        ahead_future=fetch_pool.submit(
            prepare_next,ahead,overlap_bytes(current,ahead,args.crossfade))
        while True:
            # 'source_select' is a playout decision, never proof a listener heard it.
            trace("source_select",{"mode":"stream","track_id":current["id"],
                 "kind":current.get("kind","song"),"reason":"automatic"})
            print("ON AIR:",current["artist"],"—",current["title"],flush=True)
            tail_size=overlap_bytes(current,ahead,args.crossfade)
            try:
                tail=pump_with_tail(decode_current,write,tail_size)
                # Completed decoders must not accumulate in long-running radio.
                prepared_decoders.discard(decode_current)
                # The opening PCM should already be available: no decoder
                # startup pause between the tail and this crossfade.
                head_process,head=ahead_future.result(timeout=45)
                n=min(len(head),len(tail))//FRAME_BYTES*FRAME_BYTES
                if n:
                    write(tail[:-n])
                    blend = equal_power_mix(tail[-n:],head[:n])
                    middle = (n // FRAME_BYTES // 2) * FRAME_BYTES
                    write(blend[:middle])
                    cue(ahead)
                    write(blend[middle:])
                else:
                    write(tail)
                    cue(ahead)
                # If decoder reads less than requested, no source data is dropped.
                trace("boundary",{"mode":"stream","track_id":current["id"],
                      "next_track_id":ahead["id"],"reason":"automatic"})
                current=ahead
                ahead=station.next()
                ahead_future=fetch_pool.submit(
                    prepare_next,ahead,overlap_bytes(current,ahead,args.crossfade))
                decode_current=head_process
            except (OSError,ValueError,subprocess.SubprocessError) as exc:
                trace("audio_error",{"mode":"stream","track_id":current["id"],
                      "reason":"source_error"})
                print("Audio source problem; moving on:",exc,file=sys.stderr)
                if 'head_process' in locals() and head_process.poll() is None:
                    head_process.kill();head_process.wait()
                # Do not reuse a stale predecoded future after skipping a
                # broken source: that would replay the wrong opening audio.
                if ahead_future.done() and not ahead_future.cancelled():
                    try:
                        unused,_=ahead_future.result()
                        if unused.poll() is None:
                            unused.kill();unused.wait()
                        prepared_decoders.discard(unused)
                    except (OSError,ValueError,subprocess.SubprocessError):
                        pass
                else:
                    ahead_future.cancel()
                current=ahead
                ahead=station.next()
                decode_current=decode(cache_track(current,cache))
                ahead_future=fetch_pool.submit(
                    prepare_next,ahead,overlap_bytes(current,ahead,args.crossfade))
                # Leave the single source connection open across a bad song.
                cue(None)
                write(b"\0"*(RATE*FRAME_BYTES))
                cue(current)
    except StopIteration:
        print("Station One stopping; flushing audio segments.",flush=True)
    finally:
        if server:
            server.shutdown()
            server.server_close()
            if tower:
                server.unregister_desk()
        # Let a pending predecode finish before releasing its FFmpeg handle.
        # This worker only reads a short opening; it cannot stream a whole
        # recording in the background. A rare bad network source can still
        # delay teardown, bounded by cache_track's existing HTTP timeout.
        fetch_pool.shutdown(wait=True,cancel_futures=True)
        for proc in prepared_decoders:
            if proc.poll() is None:
                proc.kill()
                try:proc.wait(timeout=5)
                except subprocess.TimeoutExpired:pass
        # An interrupted preview must not leave decoder processes holding pipes.
        for proc in [locals().get("decode_current"),locals().get("head_process")]:
            if proc is not None and proc.poll() is None:
                proc.kill()
                try:proc.wait(timeout=5)
                except subprocess.TimeoutExpired:pass
        try:encoder.stdin.close()
        except (BrokenPipeError,OSError):pass
        try:encoder.wait(timeout=45)
        except subprocess.TimeoutExpired:
            encoder.kill();encoder.wait()
        # At this point encoder has terminated; file-output failures should
        # never be reported as a successful preview if FFmpeg failed at flush.
        if encoder.returncode not in (None,0) and (args.file_output or args.hls_dir) and sys.exc_info()[0] is None:
            raise RuntimeError("Local MP3 preview FFmpeg encoder exited with code "+
                               str(encoder.returncode)+". Check the FFmpeg error above.")

def main():
    configure_log_output()
    p=argparse.ArgumentParser(description="HUMKIN always-on audio source; physical server setup required")
    p.add_argument("--dry-run",action="store_true",help="show the next 20 selections; no downloads or publishing")
    p.add_argument("--seed",type=int,help="deterministic program selection for offline tests")
    p.add_argument("--retry-count",type=int,default=5,help="bounded retries after Icecast disconnect")
    p.add_argument("--fixture",type=Path,help="test with a local exported catalog JSON")
    p.add_argument("--at",help="dry-run timestamp (e.g. 2026-11-13T13:30:00+00:00)")
    p.add_argument("--cache",default="./radio-cache",help="local MP3 cache folder")
    p.add_argument("--black-box-file",type=Path,help="optional local private diagnostic JSONL; never uploaded")
    p.add_argument("--icecast-url",help="private Icecast source URL; prefer env HUMKIN_ICECAST_URL")
    p.add_argument("--file-output",type=Path,help="local MP3 test output instead of broadcasting")
    p.add_argument("--hls-dir",type=Path,help="encode live AAC/HLS to local directory for R2 publisher")
    p.add_argument("--stop-file",type=Path,help="managed HLS stop marker path (local)")
    p.add_argument("--run-id",help="managed HLS session identifier")
    p.add_argument("--seconds",type=int,default=0,help="limit local test output duration")
    p.add_argument("--bitrate",type=int,default=128,choices=[96,128,160,192])
    p.add_argument("--crossfade",type=float,default=1.5,help="equal-power crossfade seconds, 0–5")
    p.add_argument("--tower-root", type=Path, help="shared media and programming directory for the HUMKIN Tower")
    p.add_argument("--frequency", default="station-one", help="frequency ID on this computer")
    p.add_argument("--on-air-state", type=Path, help="enable local controls with a private state file")
    p.add_argument("--on-air-port", type=int, default=0, help="loopback desk port (0 picks a free port)")
    p.add_argument("--open-on-air", action="store_true", help="open the operator interface in the local browser")
    args=p.parse_args()
    if not FREQUENCY.fullmatch(args.frequency) or not 0 <= args.on_air_port <= 65535:
        p.error("Invalid frequency or desk port")
    if args.tower_root and args.on_air_state:
        p.error("Choose either --tower-root or --on-air-state")
    if sum(bool(x) for x in (args.hls_dir,args.file_output,args.icecast_url))>1:
        p.error("Choose only one output: --hls-dir, --file-output, or --icecast-url")
    if bool(args.stop_file)!=bool(args.run_id) or (args.run_id and not re.fullmatch(r"[0-9a-f]{32}",args.run_id)):
        p.error("--stop-file and --run-id must be provided together")
    if args.stop_file and not args.hls_dir:
        p.error("--stop-file is only supported in HLS mode")
    if not 0<=args.crossfade<=5:p.error("--crossfade must be between 0 and 5")
    if not 0<=args.retry_count<=100:p.error("--retry-count must be between 0 and 100")
    if args.fixture:catalog=json.loads(args.fixture.read_text(encoding="utf-8"))
    else:catalog=live_catalog()
    if args.dry_run:
        station=StationV2(catalog,seed=args.seed if args.seed is not None else 2026) if catalog.get("policy_version")==2 else Station(catalog)
        at=datetime.fromisoformat(args.at.replace("Z","+00:00")) if args.at else datetime.now(timezone.utc)
        print("SIMULATED show:",(station.program(at) or {}).get("name","all-music"),"at",at.astimezone(ZONE))
        for n in range(20):
            track=station.next(at)
            print(f"{n+1:02d} {track['kind']:7} {track.get('artist','HUMKIN')} — {track['title']}")
        return
    for attempt in range(args.retry_count+1):
        try:
            streaming(catalog,args)
            return
        except (OSError,RuntimeError,subprocess.SubprocessError):
            if args.file_output or args.hls_dir or attempt>=args.retry_count:raise
            delay=min(60,2**attempt)
            if args.black_box_file:
                try:BlackBox(args.black_box_file).record("reconnect",{"mode":"stream","reason":"reconnect"})
                except OSError:pass
            print("Broadcast disconnected; reconnecting after "+str(delay)+"s.",file=sys.stderr)
            time.sleep(delay)
            if not args.fixture:catalog=live_catalog()
if __name__=="__main__":
    main()
