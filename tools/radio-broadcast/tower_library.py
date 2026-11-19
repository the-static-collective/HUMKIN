"""A shared Acer media crate and loopback registry for running frequencies."""
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from now_playing import write_json


FREQUENCY = re.compile(r"[a-z0-9][a-z0-9-]{0,31}\Z")
DIGEST = re.compile(r"[0-9a-f]{64}\Z")
MAX_UPLOAD = 300 * 1024 * 1024
UPLOAD_TYPES = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".aiff", ".aif"}


class TowerLibrary:
    def __init__(self, root, frequency):
        if not FREQUENCY.fullmatch(frequency):
            raise ValueError("Use a lowercase frequency name with letters, numbers or hyphens.")
        self.root = Path(root)
        self.media = self.root / "media"
        self.active = self.root / "active"
        self.frequency = frequency
        for directory in (self.media, self.active):
            directory.mkdir(parents=True, exist_ok=True)

    @property
    def registration(self):
        return self.active / (self.frequency + ".json")

    def register(self, port, token):
        write_json(self.registration, {"port": port, "token": token})

    def unregister(self, token):
        try:
            if json.loads(self.registration.read_text())["token"] == token:
                self.registration.unlink(missing_ok=True)
        except (OSError, ValueError, KeyError):
            pass

    def frequencies(self):
        peers = []
        for path in sorted(self.active.glob("*.json")):
            if len(peers) == 20 or not FREQUENCY.fullmatch(path.stem):
                continue
            try:
                with self.peer(path.stem, "/state?summary=1") as response:
                    peers.append({"id": path.stem, "url": "http://" + response.url.split("/")[2] + "/",
                                  "current": json.load(response)["current"]})
            except (OSError, ValueError, KeyError):
                continue
        return peers

    def peer(self, frequency, route, action=None):
        if not isinstance(frequency, str) or not FREQUENCY.fullmatch(frequency):
            raise ValueError("Choose a running frequency.")
        record = json.loads((self.active / (frequency + ".json")).read_text())
        port = int(record["port"])
        if not 1 <= port <= 65535:
            raise ValueError("Invalid station port.")
        origin = f"http://127.0.0.1:{port}"
        headers = {"X-Station-Control": record["token"], "Origin": origin}
        body = json.dumps(action).encode() if action is not None else None
        return urlopen(Request(origin + route, body, headers), timeout=0.7 if body is None else 5)

    def route(self, frequency, id_):
        try:
            with self.peer(frequency, "/action", {"action": "queue_end", "id": id_}) as response:
                return f"Queued on {frequency}."
        except HTTPError as exc:
            if exc.code == 409:
                raise ValueError(json.load(exc)["message"]) from exc
            raise ValueError("That frequency did not accept the track.") from exc
        except (OSError, KeyError) as exc:
            raise ValueError("That frequency is offline or busy.") from exc

    def find_tracks(self, catalog):
        for file in self.media.glob("*.json"):
            if not DIGEST.fullmatch(file.stem) or "upload-" + file.stem in catalog:
                continue
            try:
                track = json.loads(file.read_text(encoding="utf-8"))
                if Path(track["local_audio"]).is_file():
                    catalog[track["id"]] = track
            except (OSError, ValueError, KeyError):
                continue

    def import_track(self, name, size, source):
        filename = name.replace("\\", "/").rsplit("/", 1)[-1]
        suffix = Path(filename).suffix.lower()
        if suffix not in UPLOAD_TYPES:
            raise ValueError("Choose an MP3, WAV, M4A, AAC, FLAC, Ogg, Opus or AIFF file.")
        if not 0 < size <= MAX_UPLOAD:
            raise ValueError("Each file must be between 1 byte and 300 MiB.")
        temporary = None
        digest = hashlib.sha256()
        try:
            with tempfile.NamedTemporaryFile(dir=self.media, suffix=suffix, delete=False) as handle:
                temporary = Path(handle.name)
                while size:
                    chunk = source.read(min(size, 1024 * 1024))
                    if not chunk:
                        raise ValueError("The upload ended before the file arrived.")
                    size -= len(chunk)
                    digest.update(chunk)
                    handle.write(chunk)
            return self.register_track(temporary, digest.hexdigest(), filename)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def register_track(self, temporary, digest, filename):
        entry = self.media / (digest + ".json")
        if entry.exists():
            existing = json.loads(entry.read_text(encoding="utf-8"))
            if Path(existing["local_audio"]).is_file():
                return existing
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-protocol_whitelist", "file",
                 "-show_format", "-show_streams", "-of", "json", str(temporary)],
                capture_output=True, check=True, timeout=20,
            )
            probe = json.loads(result.stdout)
            info = probe["format"]
            duration = float(info.get("duration", 0))
            if (not math.isfinite(duration) or not 0 < duration <= 14400
                    or not any(stream["codec_type"] == "audio" for stream in probe["streams"])):
                raise ValueError("The file must contain playable audio under four hours.")
        except (subprocess.SubprocessError, KeyError, ValueError) as exc:
            raise ValueError("FFmpeg could not read a usable audio recording from this file.") from exc
        actual = self.media / (digest + temporary.suffix)
        tags = {key.lower(): value for key, value in info.get("tags", {}).items()}
        track = {"id": "upload-" + digest, "title": tags.get("title") or Path(filename).stem,
                 "artist": tags.get("artist") or "Unknown artist", "album": tags.get("album") or "",
                 "duration": duration, "kind": "song", "source": "upload",
                 "local_audio": str(actual)}
        cover = self.media / (digest + ".jpg")
        if any(stream.get("disposition", {}).get("attached_pic") for stream in probe["streams"]):
            try:
                picture = subprocess.run(
                    ["ffmpeg", "-v", "error", "-protocol_whitelist", "file", "-i", str(temporary),
                     "-map", "0:v:0", "-frames:v", "1", "-vf", "scale=512:512:force_original_aspect_ratio=decrease",
                     "-threads", "1", "-c:v", "mjpeg", "-f", "image2pipe", "-"],
                    capture_output=True, check=True, timeout=20,
                ).stdout
                if 0 < len(picture) <= 512 * 1024:
                    with tempfile.NamedTemporaryFile(dir=self.media, delete=False) as handle:
                        temp_cover = Path(handle.name)
                        handle.write(picture)
                    try:
                        temp_cover.replace(cover)
                        track["local_art"] = digest
                    finally:
                        temp_cover.unlink(missing_ok=True)
            except (OSError, subprocess.SubprocessError):
                pass
        try:
            if not actual.exists():
                temporary.replace(actual)
        except PermissionError:
            # Another frequency may have imported this identical file first.
            if not actual.is_file():
                raise
        write_json(entry, track)
        return track

