"""Attach Acer playout cues to the audio timeline carried in the HLS manifest."""
import base64
from datetime import datetime, timedelta
import json
from pathlib import Path
import tempfile
import threading
from urllib.parse import urlsplit


SEGMENT_SECONDS = 10
CUE_FILE = "now-playing.json"


def write_json(path, value):
    """Atomic replacement for concurrently read station documents."""
    path = Path(path)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        try:
            handle.write(json.dumps(value, ensure_ascii=False).encode("utf-8"))
        except BaseException:
            handle.close()
            temporary.unlink(missing_ok=True)
            raise
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def artwork_url(value):
    """Publish only public artwork URLs from the station's approved media hosts."""
    if not isinstance(value, str):
        return None
    try:
        url = urlsplit(value)
        if (url.scheme == "https" and len(value) <= 512 and url.netloc in (
            "humkin.abundent.org", "media.abundent.org", "kbhqacsdvjsstzyplqij.supabase.co"
        ) and not url.query and not url.fragment):
            return value
    except ValueError:
        pass
    return None


class CueSheet:
    def __init__(self, directory, first_sequence):
        self.path = Path(directory) / CUE_FILE
        self.entries = []
        self.lock = threading.RLock()
        self.first_sequence = first_sequence

    def record(self, seconds, item):
        with self.lock:
            if item is None:
                track = None
            else:
                track = {key: str(item.get(key) or "")[:240]
                         for key in ("id", "title", "artist", "album")}
                track["artwork"] = artwork_url(item.get("artwork"))
                if item.get("local_art"):
                    track["local_art"] = item["local_art"]
            cue = {"offset": round(seconds, 3), "track": track}
            if self.entries and self.entries[-1]["offset"] == cue["offset"]:
                self.entries.pop()
            self.entries.append(cue)
            while len(self.entries) > 1 and self.entries[1]["offset"] < seconds - 360:
                self.entries.pop(0)
            try:
                write_json(self.path, {"sequence": self.first_sequence, "events": self.entries})
            except OSError:
                # Metadata availability must never determine audio continuity.
                pass


def insert_cues(playlist, directory, session, resolve_art=lambda _: None, clock=None):
    """Retain the preceding cue and any transitions inside the current HLS window."""
    try:
        sheet = json.loads((Path(directory) / CUE_FILE).read_text(encoding="utf-8"))
        lines = playlist.decode("utf-8").splitlines()
        sequence = int(next(line.split(":", 1)[1] for line in lines
                            if line.startswith("#EXT-X-MEDIA-SEQUENCE:")))
        pdt = next(line.split(":", 1)[1] for line in lines
                   if line.startswith("#EXT-X-PROGRAM-DATE-TIME:"))
        start = datetime.fromisoformat(pdt.replace("Z", "+00:00"))
        relative = sequence - sheet["sequence"]
        if start.tzinfo is None or relative < 0:
            return playlist
        entries = sheet["events"]
        window_start = relative * SEGMENT_SECONDS
        window_end = window_start + sum(float(line[8:].split(",", 1)[0])
                                        for line in lines if line.startswith("#EXTINF:"))
        # AAC packet boundaries can move a nominal segment cut by one packet.
        # All cue times share the same media clock as the first sample.
        origin = start - timedelta(seconds=window_start)
        if clock is not None:
            origin = clock.setdefault("origin", origin)
        before, within = [], []
        for cue in entries:
            when = cue["offset"]
            if when <= window_start:
                before = [cue]
            elif when < window_end:
                within.append(cue)
        ranges = []
        for cue in before + within:
            track = cue["track"]
            if track is not None:
                track = track.copy()
                local_art = track.pop("local_art", None)
                if local_art:
                    track["artwork"] = resolve_art(local_art) or track.get("artwork")
            data = base64.urlsafe_b64encode(json.dumps(
                track, ensure_ascii=False, separators=(",", ":")).encode()).decode().rstrip("=")
            date = (origin + timedelta(seconds=cue["offset"])).isoformat(timespec="milliseconds")
            key = f'{session}-{round(cue["offset"] * 1000)}'
            ranges.append(f'#EXT-X-DATERANGE:ID="{key}",CLASS="org.abundent.humkin.track",'
                          f'START-DATE="{date}",X-HUMKIN="{data}"')
        return ("\n".join(lines[:1] + ranges + lines[1:]) + "\n").encode()
    except (OSError, ValueError, TypeError, KeyError, StopIteration, OverflowError):
        return playlist

