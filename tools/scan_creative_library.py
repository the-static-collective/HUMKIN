#!/usr/bin/env python3
"""Local-first creative inventory. No upload, deletion, move, rename, or automatic public release.

Usage:
    python3 tools/scan_creative_library.py "/path/to/Flow videos" --out flow-inventory.json --hash --probe
    python3 tools/scan_creative_library.py "/path/to/Creative Archive" --out everything.json

SHA-256 is optional because hashing hundreds of large videos can take time.
All paths in outputs are RELATIVE to the scanned root; inspect before sharing.
"""
import argparse
import csv
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

EXTENSIONS = {
    "video": {".mp4",".mov",".mkv",".webm",".m4v",".avi",".mpeg",".mpg"},
    "music": {".wav",".mp3",".flac",".m4a",".aac",".ogg",".aif",".aiff",".mid",".midi"},
    "images": {".jpg",".jpeg",".png",".webp",".gif",".tif",".tiff",".svg",".psd",".kra",".xcf"},
    "manga": {".cbz",".cbr",".epub"},
    "documents": {".pdf",".doc",".docx",".odt",".txt",".md",".rtf",".html",".ppt",".pptx"},
    "games": {".json",".csv",".zip",".unity",".godot"},
    "design": {".blend",".stl",".obj",".fbx",".gltf",".glb",".ai",".eps",".indd",".dwg",".dxf",".svg",".usd",".usdz"},
}
SKIP_DIRS = {".git","node_modules","__pycache__", ".venv", "venv", "System Volume Information"}

def utc(ts):
    return datetime.datetime.fromtimestamp(ts,datetime.timezone.utc).isoformat()

def category(suffix):
    for kind, extensions in EXTENSIONS.items():
        if suffix.lower() in extensions:
            return kind
    return None

def sha256_file(path):
    digest = hashlib.sha256()
    with open(path,"rb") as stream:
        while True:
            chunk=stream.read(1024*1024*4)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()

def duration(path):
    if not shutil.which("ffprobe"):
        return None
    try:
        p=subprocess.run(
            ["ffprobe","-v","error","-show_entries","format=duration",
             "-of","default=noprint_wrappers=1:nokey=1",str(path)],
            stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=20,check=False)
        val=float(p.stdout.decode("ascii",errors="ignore").strip())
        return round(val,3) if val >= 0 else None
    except (ValueError,OverflowError,OSError,subprocess.TimeoutExpired):
        return None

def scan(root, output_paths, do_hash=False, do_probe=False, include_unknown=False):
    entries=[]
    seen_hash={}
    errors=[]
    root=root.resolve()
    for parent,dirs,files in os.walk(str(root),followlinks=False):
        dirs[:]=sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")
                       and not (Path(parent)/d).is_symlink())
        for name in sorted(files):
            if name.startswith("."):
                continue
            path=Path(parent)/name
            if path.is_symlink() or path.resolve() in output_paths:
                continue
            kind=category(path.suffix)
            if not kind and not include_unknown:
                continue
            rel=path.relative_to(root).as_posix()
            try:
                stat=path.stat()
                row={"id":"local:"+hashlib.sha256(rel.encode("utf-8")).hexdigest()[:20],
                     "title":path.name,"relative_path":rel,"kind":kind or "other",
                     "size_bytes":stat.st_size,"modified_utc":utc(stat.st_mtime),
                     "availability":"local-only","rights":{"status":"review_required"},
                     "source_provenance":"unverified"}
                if do_hash:
                    h=sha256_file(path)
                    row["sha256"]=h
                    if h in seen_hash:
                        row["duplicate_of"]=seen_hash[h]
                    else:
                        seen_hash[h]=row["id"]
                if do_probe and kind in ("video","music"):
                    d=duration(path)
                    if d is not None:
                        row["duration_sec"]=d
                entries.append(row)
            except (OSError,PermissionError) as e:
                errors.append({"relative_path":rel,"error":type(e).__name__})
    return entries,errors

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("folder",type=Path,help="Local folder to inventory recursively")
    p.add_argument("--out",type=Path,default=Path("commons-inventory.json"),help="JSON output (CSV alongside it)")
    p.add_argument("--hash",action="store_true",help="Compute full SHA-256 and identify exact duplicates (slow for videos)")
    p.add_argument("--probe",action="store_true",help="Use ffprobe for video/audio duration if installed")
    p.add_argument("--all",action="store_true",help="Include unknown file extensions too")
    args=p.parse_args(argv)
    if not args.folder.is_dir():
        p.error("Folder does not exist or is not readable.")
    out=args.out.expanduser().absolute()
    csv_out=out.with_suffix(".csv")
    out.parent.mkdir(parents=True,exist_ok=True)
    entries,errors=scan(args.folder,{out.resolve(),csv_out.resolve()},args.hash,args.probe,args.all)
    manifest={"schema_version":"commons.intake.v0.1",
              "created_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "notice":"Local metadata only. No files uploaded. No reuse permissions granted. Media NOT backed up.",
              "root_label":args.folder.name,
              "entries":entries,"scan_errors":errors}
    with open(out,"w",encoding="utf-8") as f:
        json.dump(manifest,f,indent=2,ensure_ascii=False)
        f.write("\n")
    fields=["id","title","relative_path","kind","size_bytes","modified_utc","sha256","duplicate_of",
            "duration_sec","availability","source_provenance"]
    with open(csv_out,"w",encoding="utf-8",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore")
        writer.writeheader()
        writer.writerows(entries)
    print("Indexed {} creative files; {} unreadable files.".format(len(entries),len(errors)))
    print("JSON: {}".format(out))
    print("CSV:  {}".format(csv_out))
    if args.hash:
        print("Exact duplicates: {}".format(sum("duplicate_of" in row for row in entries)))
    print("No media uploaded, copied, moved, modified, released, or backed up.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
