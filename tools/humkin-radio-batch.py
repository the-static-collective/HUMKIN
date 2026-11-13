#!/usr/bin/env python3
"""HUMKIN radio crate maker. Convert a WAV/MP3 folder into web-sized MP3s.
Run: python3 tools/humkin-radio-batch.py "/path/to/Suno Downloads" --out "./humkin-ready"
Requires FFmpeg and ffprobe in PATH. Does not modify masters or upload anything.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

EXTS={".wav",".mp3",".m4a",".flac",".aif",".aiff",".ogg"}
def run(argv):
    completed=subprocess.run(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,check=False)
    if completed.returncode:
        raise RuntimeError((completed.stderr or completed.stdout).strip()[-600:])
    return completed.stdout
def sha256(path):
    h=hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda:handle.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()
def probe(path):
    return json.loads(run(["ffprobe","-v","error","-show_entries","format=duration:format_tags=title,artist,album","-of","json",str(path)]))["format"]
def title(name):
    s=re.sub(r"(?i)\.(wav|mp3|m4a|flac|aif|aiff|ogg)$","",name)
    s=re.sub(r"^\d{1,3}[ ._-]+","",s).replace("_"," ")
    return re.sub(r"\s+"," ",s).strip() or "Untitled song"
def main():
    p=argparse.ArgumentParser(description="Prepare a batch of Suno WAVs and MP3s for HUMKIN RADIO")
    p.add_argument("input",type=Path,help="Folder containing source WAV/MP3 files")
    p.add_argument("--out",type=Path,default=Path("humkin-ready"))
    p.add_argument("--bitrate",type=int,choices=[96,128,160,192],default=128,help="MP3 kbps (default 128)")
    p.add_argument("--album",default="HUMKIN RADIO · NEW CRATE")
    p.add_argument("--dry-run",action="store_true",help="List tracks without encoding")
    args=p.parse_args()
    if not args.input.is_dir():p.error("Input must be a directory.")
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        p.error("FFmpeg and ffprobe are required. Install FFmpeg before using this script.")
    out=args.out.resolve()
    sources=[q for q in sorted(args.input.rglob("*")) if q.is_file() and q.suffix.lower() in EXTS and out not in q.resolve().parents]
    if not sources:p.error("No supported audio files found.")
    seen=set();items=[];failed=[]
    if not args.dry_run:out.mkdir(parents=True,exist_ok=True)
    for n,path in enumerate(sources,1):
        try:
            source_hash=sha256(path)
            if source_hash in seen:
                print(f"[{n}/{len(sources)}] DUPLICATE: {path.name}")
                continue
            seen.add(source_hash)
            info=probe(path)
            seconds=float(info.get("duration",0))
            if not 1<=seconds<=14400:raise ValueError("Invalid duration")
            tags={str(k).lower():str(v) for k,v in info.get("tags",{}).items()}
            friendly=title(path.name)
            digest=hashlib.sha256((source_hash+str(args.bitrate)).encode()).hexdigest()[:12]
            stem=re.sub(r"[^a-zA-Z0-9_-]+","-",friendly.lower()).strip("-")[:62] or "track"
            filename=f"{stem}-{digest}.mp3"
            dest=out/filename
            if args.dry_run:
                print(f"[{n}/{len(sources)}] {friendly}: {seconds/60:.1f} min → {filename}")
            elif not dest.exists():
                run(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-i",str(path),
                     "-map","0:a:0","-vn","-ac","2","-ar","44100","-c:a","libmp3lame",
                     "-b:a",str(args.bitrate)+"k","-map_metadata","-1",
                     "-metadata","title="+tags.get("title",friendly),
                     "-metadata","artist="+tags.get("artist","HUMKIN"),
                     "-metadata","album="+tags.get("album",args.album),
                     "-y",str(dest)])
                print(f"[{n}/{len(sources)}] READY: {friendly} ({seconds/60:.1f} min)")
            else:print(f"[{n}/{len(sources)}] CACHED: {filename}")
            if not args.dry_run and dest.stat().st_size>50*1024*1024:
                raise ValueError("Output exceeds uploader 50 MiB limit")
            items.append({"title":tags.get("title",friendly),"album":tags.get("album",args.album),
                          "artist":tags.get("artist","HUMKIN"),"filename":filename,
                          "duration_seconds":round(seconds,3),"source_sha256":source_hash,
                          "mp3_sha256":sha256(dest) if not args.dry_run else None,
                          "bytes":dest.stat().st_size if not args.dry_run else None})
        except Exception as error:
            print(f"[{n}/{len(sources)}] ERROR {path.name}: {error}",file=sys.stderr)
            failed.append({"file":str(path),"error":str(error)})
    total=sum(x["duration_seconds"] for x in items)
    print(f"\n{len(items)} tracks · {total/3600:.2f} hours · {sum((x['bytes'] or 0) for x in items)/1024/1024:.1f} MiB · {len(failed)} errors")
    if not args.dry_run:
        path=out/"humkin-crate-manifest.json"
        path.write_text(json.dumps({"schema_version":1,"bitrate_kbps":args.bitrate,
                                    "duration_seconds":round(total,3),"tracks":items,"errors":failed},
                                   indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
        print("Next: open https://humkin.abundent.org/fm/load/ and select MP3s in "+str(out))
    return 1 if failed else 0
if __name__=="__main__":
    sys.exit(main())
