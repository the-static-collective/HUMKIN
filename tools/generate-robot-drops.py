#!/usr/bin/env python3
"""HUMKIN ROBOT DESK. Offline, deterministic, original robotic bumpers.
Produces PRIVATE review MP3s; never publishes, enables or sends audio to air.
Uses eSpeak's own English voice. NOT Microsoft SAM or a proprietary voice clone.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import random
import shutil
import subprocess
import tempfile

BANK = [
 ("administrative-coffee","HUMKIN RADIO. The coffee has achieved administrative status.","station_id","records"),
 ("yesterday-included","This broadcast contains trace amounts of yesterday.","station_id","time"),
 ("eaten-receipt","The Department of Records has eaten the receipt. Again.","character","records"),
 ("smaller-management","Station management has been replaced by smaller station management.","character","manager"),
 ("newsroom-goat","Our newsroom goat is on paid leave. It has no idea.","character","farm"),
 ("inspection-failed","The next song has passed inspection. The inspection has failed.","station_id","records"),
 ("kettle-operational","Signal good. Logic questionable. Kettle operational.","station_id","kettle"),
 ("public-silence","The following silence belongs to absolutely nobody.","station_id","silence"),
 ("chairs-on-staff","There are seven people in the control room. Six are chairs.","character","manager"),
 ("meteorological-nope","Today's forecast: more music. This is not a weather report.","station_id","news"),
 ("department-of-one","Please hold while the Department of Holding is located.","character","records"),
 ("normalization","This station has been declared mostly normal. By the station.","station_id","manager"),
 ("unfiled-sunrise","The sunrise has been filed in the wrong cabinet. Music will continue.","character","records"),
 ("unpaid-moon","The moon has not submitted a time sheet. We remain open.","character","records"),
 ("farming-frequency","The Farm Desk has confirmed that the chickens do not own the frequency.","character","farm"),
 ("chairs-are-listening","The control room chairs are listening. They are our most consistent audience.","character","manager"),
 ("tea-unauthorized","The kettle has issued an unauthorized announcement. It says, hello.","character","kettle"),
 ("station-under-chair","We found the station under a chair. The chair denies involvement.","character","records"),
]
def run(args):
 subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def probe(path):
 return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of",
  "default=noprint_wrappers=1:nokey=1",str(path)],text=True).strip())
def responsive_scripts():
 """Read canonical public station inventory only — no account or caller inputs."""
 try:
  config=json.loads(Path("fm/rotation.json").read_text(encoding="utf-8"))
  ids=json.loads(Path("fm/air-carts.json").read_text(encoding="utf-8"))
  tracks=len(config.get("tracks",[]))
  carts=len(ids.get("carts",[]))
  return [
   ("filed-originals",f"The original cabinet contains {tracks} songs. They have filed an appeal.",
    "station_id","records"),
   ("shelf-count",f"The field desk has {carts} approved recordings. The filing cabinet says nine million.",
    "character","farm")
  ]
 except (OSError,ValueError,TypeError,KeyError):
  return []
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--seed",default=None,help="Reproducible batch label; default current ISO week")
 p.add_argument("--count",type=int,default=8)
 p.add_argument("--out",default="robot-auditions")
 a=p.parse_args()
 if not all(shutil.which(x) for x in ("espeak","ffmpeg","ffprobe")):
  p.error("Install espeak and ffmpeg; never auto-air synthetic speech")
 bank=BANK+responsive_scripts()
 if not 1<=a.count<=len(bank):p.error("Invalid count")
 seed=a.seed or dt.datetime.now(dt.timezone.utc).strftime("%G-W%V")
 r=random.Random(int.from_bytes(hashlib.sha256(seed.encode()).digest()[:8],"big"))
 chosen=r.sample(bank,a.count)
 out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
 manifest={"schema":"humkin.radio.robot-drops/v1","seed":seed,
 "status":"DRAFT / HUMAN REVIEW / NOT ON AIR",
 "voice":"original retro eSpeak voice; not an exact Microsoft SAM clone",
 "items":[]}
 for n,(slug,script,role,family) in enumerate(chosen,1):
  name=f"robot-{seed.replace('/','-')}-{n:02d}-{slug}.mp3"
  with tempfile.TemporaryDirectory() as tmp:
   wav=Path(tmp)/"voice.wav"
   run(["espeak","-ven-us","-s","156","-p","28","-a","160","-w",str(wav),script])
   duration=probe(wav)
   fade=max(0,duration-.34)
   filt=("highpass=f=260,lowpass=f=3300,"
     "acompressor=threshold=-18dB:ratio=2:attack=5:release=80,"
     f"afade=t=in:st=0:d=0.05,afade=t=out:st={fade:.3f}:d=0.30")
   dest=out/name
   run(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y","-i",str(wav),
     "-af",filt,"-ar","24000","-ac","1","-b:a","80k",str(dest)])
  manifest["items"].append({"file":name,"script":script,"role":role,
     "family":family,"seconds":round(duration,2),"bytes":dest.stat().st_size,
     "sha256":hashlib.sha256(dest.read_bytes()).hexdigest(),
     "approval":"REVIEW REQUIRED — unpublished"})
 (out/"audition-manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
 print(f"Produced {len(manifest['items'])} private robotic voice drafts in {out}")
if __name__=="__main__":
 main()
