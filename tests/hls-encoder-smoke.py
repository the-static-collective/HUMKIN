#!/usr/bin/env python3
"""Exercise actual Station One FFmpeg HLS encoder with synthetic PCM only."""
import base64
from datetime import datetime
import importlib.util
import json
import re
import subprocess
import shutil
import tempfile
from pathlib import Path

if not shutil.which("ffmpeg"):
    raise SystemExit("FFmpeg is required for encoder integration smoke test")
root = Path(__file__).resolve().parents[1]
src = root / "tools" / "radio-broadcast" / "engine.py"
spec = importlib.util.spec_from_file_location("humkin_engine_for_hls", src)
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
from now_playing import CueSheet, insert_cues
from on_air import Desk
from scheduler_v2 import StationV2

with tempfile.TemporaryDirectory() as d:
    target = Path(d)
    tracks = []
    for index, tone in enumerate((220, 660)):
        audio = target / f"tone{index}.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i",
                        f"sine=frequency={tone}:sample_rate=44100", "-t", "18", str(audio)],
                       check=True, timeout=15)
        tracks.append({"id": str(index), "title": f"Tone {tone}", "artist": "Fixture",
                       "local_audio": str(audio), "duration": 18})
    schedule = StationV2({"tracks": tracks})
    desk = Desk(schedule, target / "programming.json")
    for track in tracks:
        desk.act({"action": "queue_end", "id": track["id"]})
    sequence = 1700000000
    proc = engine.output_process(str(target), 96, realtime=False, hls_dir=target, hls_start=sequence)
    sheet = CueSheet(target, sequence)
    bytes_per_second = engine.RATE * engine.FRAME_BYTES
    written = 0

    def write(pcm):
        global written
        pcm = pcm[:36 * bytes_per_second - written]
        proc.stdin.write(pcm)
        written += len(pcm)
        if written >= 36 * bytes_per_second:
            raise StopIteration

    try:
        engine.controlled_playout(desk, target, write, 1, lambda *_: None,
                                  lambda track: sheet.record(written / bytes_per_second, track))
    except StopIteration:
        pass
    proc.stdin.close()
    status = proc.wait(timeout=60)
    assert status == 0, "FFmpeg HLS encoder failed"
    content = (target / "index.m3u8").read_text(encoding="utf-8")
    assert "#EXTM3U" in content
    assert "segment-" in content
    parts = sorted(target.glob("segment-*.ts"))
    assert len(parts) >= 3, "Expected at least 3 actual AAC/TS segments"
    assert all(part.read_bytes()[:1] == b"\x47" for part in parts), "Not MPEG-TS"
    print("HUMKIN HLS encoder smoke OK:", len(parts), "synthetic segments")

    public = insert_cues(content.encode(), target, "c" * 32).decode()
    cues = re.findall(r'START-DATE="([^"]+)",X-HUMKIN="([^"]+)"', public)
    first, second = cues[:2]
    titles = [json.loads(base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)))["title"]
              for _, data in (first, second)]
    assert titles == ["Tone 220", "Tone 660"]
    delta = datetime.fromisoformat(second[0]) - datetime.fromisoformat(first[0])
    assert delta.total_seconds() == 17.5, "18-second track should switch titles at midpoint of 1s fade"
    print("HUMKIN cue arrives at the synthetic crossfade midpoint.")
