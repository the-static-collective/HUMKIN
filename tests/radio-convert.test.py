#!/usr/bin/env python3
"""End-to-end synthetic WAV converter test. Does not contact Suno or cloud."""
import hashlib
import json
import math
import shutil
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
    print("SKIP: ffmpeg/ffprobe not present in this runner")
    sys.exit(0)

with tempfile.TemporaryDirectory() as folder:
    root=Path(folder)
    input_dir=root/"source";input_dir.mkdir()
    src=input_dir/"01_Morning Song.wav"
    rate=22050;seconds=2
    with wave.open(str(src),"wb") as wav:
        wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(rate)
        data=bytearray()
        for i in range(rate*seconds):
            sample=int(math.sin(2*math.pi*330*i/rate)*12000)
            data+=struct.pack("<hh",sample,sample)
        wav.writeframes(data)
    (input_dir/"duplicate.wav").write_bytes(src.read_bytes())
    original=hashlib.sha256(src.read_bytes()).hexdigest()
    script=Path("tools/humkin-radio-batch.py").resolve()
    output=root/"ready"
    command=[sys.executable,str(script),str(input_dir),"--out",str(output),"--bitrate","128"]
    completed=subprocess.run(command,text=True,capture_output=True)
    assert completed.returncode==0,completed.stderr
    manifest=json.loads((output/"humkin-crate-manifest.json").read_text())
    assert len(manifest["tracks"])==1,"Content-identical input files should deduplicate"
    track=manifest["tracks"][0]
    assert track["duration_seconds"]>1.9
    assert track["bytes"]<100000
    assert (output/track["filename"]).is_file()
    assert hashlib.sha256((output/track["filename"]).read_bytes()).hexdigest()==track["mp3_sha256"]
    assert hashlib.sha256(src.read_bytes()).hexdigest()==original,"Never alter input WAV masters"
    again=subprocess.run(command,text=True,capture_output=True)
    assert again.returncode==0,again.stderr
    assert "CACHED" in again.stdout
print("Radio crate converter passed: local WAV conversion, duplicate skip, manifest, repeat-safe cache, masters preserved")
