#!/usr/bin/env python3
"""Exercise actual Station One FFmpeg HLS encoder with synthetic PCM only."""
import importlib.util
import shutil
import struct
import tempfile
from pathlib import Path

if not shutil.which("ffmpeg"):
    raise SystemExit("FFmpeg is required for encoder integration smoke test")
root = Path(__file__).resolve().parents[1]
src = root / "tools" / "radio-broadcast" / "engine.py"
spec = importlib.util.spec_from_file_location("humkin_engine_for_hls", src)
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)

with tempfile.TemporaryDirectory() as d:
    target = Path(d)
    proc = engine.output_process(str(target), 96, realtime=False, hls_dir=target)
    # 36 seconds of quiet stereo PCM; use bounded writes to avoid huge buffers.
    frame = struct.pack("<hh", 0, 0)
    chunk = frame * engine.RATE
    for _ in range(36):
        proc.stdin.write(chunk)
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
