"""HUMKIN RADIO — opt-in cloud production (NOT a live transmitter).

On-demand, accelerated offline renders from the actual published music catalog.
Runs entirely on Modal after a valid Modal account token is configured.
A rendered file stays PRIVATE in a Modal Volume until the owner downloads
and explicitly publishes it. No microphone, streaming server or public feed.
"""
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from uuid import uuid4
import subprocess
import sys

import modal

app = modal.App("humkin-radio-production")
volume = modal.Volume.from_name("humkin-radio-renders", create_if_missing=True)
ENGINE = Path(__file__).with_name("engine.py")
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .add_local_file(str(ENGINE), "/app/engine.py")
)

@app.function(image=image, volumes={"/radio": volume}, cpu=1.0, memory=1024, timeout=3600)
def render_preview(minutes: int = 5) -> dict:
    if isinstance(minutes, bool) or not isinstance(minutes, int) or not 1 <= minutes <= 60:
        raise ValueError("Duration must be an integer between 1 and 60 minutes.")
    output_name = (
        "humkin-preview-"
        + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        + "-"
        + uuid4().hex[:8]
        + ".mp3"
    )
    output = Path("/radio") / output_name
    command = [
        sys.executable, "/app/engine.py",
        "--file-output", str(output),
        "--seconds", str(minutes * 60),
        "--bitrate", "128",
        "--crossfade", "1.2",
        "--cache", "/tmp/humkin-radio-cache"
    ]
    # Existing Icecast-source engine runs the file encoder without '-re'
    # so this render finishes as quickly as resources/network allow.
    subprocess.run(command, check=True, timeout=3550)
    if not output.is_file() or output.stat().st_size <= 10000:
        raise RuntimeError("A valid private MP3 preview was not rendered.")
    size = output.stat().st_size
    digest = sha256()
    with output.open("rb") as file:
        while chunk := file.read(1024 * 1024):
            digest.update(chunk)
    volume.commit()
    return {
        "volume": "humkin-radio-renders", "path": output_name,
        "bytes": size, "sha256": digest.hexdigest(),
        "status": "private preview — NOT live radio"
    }

@app.local_entrypoint()
def main(minutes: int = 5):
    if not 1 <= minutes <= 60:
        raise ValueError("Choose 1–60 minutes. No automatic schedule is configured.")
    result = render_preview.remote(minutes)
    print("PRIVATE HUMKIN PREVIEW:", result)
    print("Download explicitly with: modal volume get humkin-radio-renders " + result["path"])
    print("The preview is NOT published to the HUMKIN station.")
