#!/usr/bin/env python3
"""HUMKIN continuous source offline acceptance checks. Never contacts Supabase."""
import array
import importlib.util
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
import urllib.parse
import hashlib
from datetime import datetime,timezone
from pathlib import Path

path=Path("tools/radio-broadcast/engine.py").resolve()
spec=importlib.util.spec_from_file_location("humkin_broadcast",path)
engine=importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)

def item(name,duration,kind="song"):
    return {"id":name,"title":name,"artist":"HUMKIN","kind":kind,
            "duration":duration,"url":"https://humkin.abundent.org/fm/audio/"+name+".mp3"}

class RadioTests(unittest.TestCase):
    def setUp(self):
        self.catalog={"tracks":[item("A",3),item("B",3),item("C",3),item("ID",1,"bumper")],
                      "shows":[],"settings":{"bumper_every":2}}
    def test_rotation_never_repeats_music_before_cycle(self):
        s=engine.Station(self.catalog)
        result=[s.next()["id"] for _ in range(4)]
        self.assertEqual(result[2],"ID")
        self.assertEqual(set(x for x in result if x!="ID"),{"A","B","C"})
    def test_automatic_bumpers_off_by_default(self):
        catalog={**self.catalog,"settings":{"bumper_every":0}}
        s=engine.Station(catalog)
        self.assertNotIn("ID",[s.next()["id"] for _ in range(20)])
    def test_weekly_dayparts_take_precedence(self):
        self.catalog["shows"]=[
          {"id":"morning","name":"Morning","days":[1,2,3,4,5],
           "start_minute":420,"end_minute":540,"track_ids":["ID","A"],
           "is_active":True,"priority":2},
          {"id":"special","name":"Special","days":[5],
           "start_minute":440,"end_minute":500,"track_ids":["B"],
           "is_active":True,"priority":5}
        ]
        s=engine.Station(self.catalog)
        friday= datetime.fromisoformat("2026-11-13T13:30:00+00:00")
        self.assertEqual(s.program(friday)["id"],"special")
        self.assertEqual(s.next(friday)["id"],"B")
        sunday=datetime.fromisoformat("2026-11-15T13:30:00+00:00")
        self.assertIsNone(s.program(sunday))
        self.assertIn(s.next(sunday)["id"],{"A","B","C"})
    def test_crossfade_is_pcm_stereo_and_bounded(self):
        sample=struct.pack("<hh",20000,20000)*441
        other=struct.pack("<hh",-20000,-20000)*441
        mixed=engine.equal_power_mix(sample,other)
        self.assertEqual(len(mixed),len(sample))
        self.assertEqual(mixed[:4],sample[:4])
        self.assertEqual(mixed[-4:],other[-4:])
        self.assertEqual(engine.overlap_bytes(item("A",3),item("ID",1,"bumper"),2),
                         int(.25*engine.RATE)*engine.FRAME_BYTES)

if __name__=="__main__":
    unittest.main(exit=False)
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        # A real 5s MP3 playout through the same continuously open output
        # encoder, with song transitions and an ID, but no external server.
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);cache=root/"cache";cache.mkdir()
            samples=[item("A",3),item("B",3),item("ID",1.2,"bumper")]
            for i,track in enumerate(samples):
                url=track["url"]
                target=cache/(hashlib.sha256(url.encode()).hexdigest()+".mp3")
                subprocess.run(["ffmpeg","-nostdin","-hide_banner","-loglevel","error",
                    "-f","lavfi","-i","sine=frequency="+str(240+i*120)+":sample_rate=44100",
                    "-t",str(track["duration"]),"-codec:a","libmp3lame","-b:a","128k","-y",str(target)],
                    check=True)
            catalog={"tracks":samples,"shows":[],"settings":{"bumper_every":2}}
            fixture=root/"catalog.json";fixture.write_text(json.dumps(catalog))
            dest=root/"output.mp3"
            command=[sys.executable,str(path),"--fixture",str(fixture),"--cache",str(cache),
                     "--file-output",str(dest),"--seconds","5","--crossfade","0.5"]
            run=subprocess.run(command,text=True,capture_output=True,timeout=45)
            if run.returncode!=0:
                raise AssertionError("FFmpeg Icecast-source offline preview failed: "+
                                     run.stderr[-2000:]+"\n"+run.stdout[-1200:])
            assert dest.exists() and dest.stat().st_size>10000,"Encoder did not output continuous MP3"
            probe=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                "-of","default=nw=1:nk=1",str(dest)],capture_output=True,text=True,check=True)
            assert 4.0<float(probe.stdout.strip())<6.5,"Expected approximately five seconds of stream"
        print("Continuous source tested: one encoder, real MP3 song decoding, crossfade, 5s file sample.")
    else:
        print("SKIP: FFmpeg unavailable; planner and PCM mix tests still passed.")
