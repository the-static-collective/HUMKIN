"""Public archive metadata for the private, loopback-only HUMKIN Tower."""
import json
import re
import threading
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

API = "https://kbhqacsdvjsstzyplqij.supabase.co"
ENDPOINT = API + "/functions/v1/humkin-compost"
PUBLIC_HOSTS = {"humkin.abundent.org", "media.abundent.org", urlsplit(API).netloc}
ID = re.compile(r"[A-Za-z0-9-]{3,90}\Z")
LOCK = threading.Lock()
CACHE = None
EXPIRES = 0


def media_url(value, artwork=False):
    if not isinstance(value, str):
        return None
    url = urlsplit(value)
    if url.scheme != "https" or url.query or url.fragment or url.netloc not in PUBLIC_HOSTS:
        return None
    extensions = (".jpg", ".jpeg", ".png", ".webp") if artwork else (".mp3",)
    if not url.path.lower().endswith(extensions):
        return None
    if url.netloc == urlsplit(API).netloc:
        bucket = "humkin-radio-art" if artwork else "humkin-radio-live"
        if not url.path.startswith("/storage/v1/object/public/" + bucket + "/"):
            return None
    return value


def archive_snapshot():
    global CACHE, EXPIRES
    with LOCK:
        if CACHE is not None and time.monotonic() < EXPIRES:
            return CACHE
        request = Request(ENDPOINT, headers={"User-Agent": "HUMKIN-Tower"})
        with urlopen(request, timeout=9) as response:
            payload = json.load(response)
        tracks = []
        for row in payload["tracks"]:
            id_, url = row.get("id", ""), media_url(row.get("src"))
            duration = float(row.get("duration") or 0)
            if not isinstance(id_, str) or not ID.fullmatch(id_) or not url or not 0 < duration < 14400:
                continue
            tracks.append({"id": id_, "url": url, "duration": duration, "source": "archive",
                           "title": row.get("title") or "Untitled", "artist": row.get("artist") or "HUMKIN",
                           "album": row.get("album") or "", "kind": row.get("kind") or "song",
                           "artwork": media_url(row.get("artwork"), artwork=True)})
        CACHE = (tracks, payload["scores"])
        EXPIRES = time.monotonic() + 45
        return CACHE
