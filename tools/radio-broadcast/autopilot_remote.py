"""Allowlisted published HUMKIN audio fetches for Cloud Autopilot preview.

Never accept an arbitrary URL from a local plan. The URL must have originated
from a Tower handoff and match an existing published HUMKIN media namespace.
Remote MP3s are downloaded to a bounded temporary file, SHA-256 checked and
discarded immediately after transcoding. The resulting AAC cache is reusable.
"""
from contextlib import contextmanager
from hashlib import sha256
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import unquote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from catalog_sources import r2_public_url

SUPABASE = "kbhqacsdvjsstzyplqij.supabase.co"
HOSTS = {
    "r2": {"media.abundent.org"},
    "cloud": {"media.abundent.org", SUPABASE},
    "archive": {"media.abundent.org", "humkin.abundent.org", SUPABASE},
    "static": {"humkin.abundent.org"},
}
MAX_BYTES = 300 * 1024 * 1024
SHA = re.compile(r"[0-9a-f]{64}\Z")


def published_audio_url(url, source):
    """Validate precisely the public namespaces used by HUMKIN's catalogue."""
    if not isinstance(url, str) or not isinstance(source, str) or source not in HOSTS:
        raise ValueError("Remote audio must come from a published HUMKIN catalogue.")
    if len(url) > 1200 or url != url.strip():
        raise ValueError("Invalid remote audio URL.")
    try:
        parts = urlsplit(url)
        port = parts.port  # Force validation, not just hostname parsing.
    except ValueError as exc:
        raise ValueError("Invalid remote audio URL.") from exc
    if (parts.scheme != "https" or parts.hostname not in HOSTS[source]
            or parts.username is not None or parts.password is not None
            or port is not None or parts.query or parts.fragment
            or parts.netloc != parts.hostname):
        raise ValueError("Remote audio host is not an approved HUMKIN source.")
    path = unquote(parts.path)
    if (not path.endswith(".mp3") or not path.startswith("/")
            or "//" in path or "\\" in path or "\x00" in path
            or any(segment in ("", ".", "..") or any(ord(c) < 32 for c in segment)
                   for segment in path[1:].split("/"))):
        raise ValueError("Unsafe or non-audio remote object path.")
    if parts.hostname == "media.abundent.org":
        if path.startswith(("/autopilot/", "/hls/", "/live/")):
            raise ValueError("Live and program internals are not source recordings.")
        if r2_public_url(path[1:]) != url:
            raise ValueError("Remote R2 audio URL must have a canonical object key.")
    elif parts.hostname == "humkin.abundent.org":
        if not path.startswith("/fm/") or path != parts.path:
            raise ValueError("Only published HUMKIN FM recordings may be used.")
    else:
        if (not path.startswith("/storage/v1/object/public/humkin-radio-live/")
                or path != parts.path):
            raise ValueError("Only the public HUMKIN recording bucket may be used.")
    return url


class _NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError("Remote audio redirects are not permitted.")


@contextmanager
def verified_remote_file(url, source, cache, expected_sha=None, *, opener=None):
    """Yield (temporary local path, verified SHA) and remove it on every exit."""
    published_audio_url(url, source)
    if expected_sha is not None and (not isinstance(expected_sha, str)
                                     or not SHA.fullmatch(expected_sha)):
        raise ValueError("Expected source SHA-256 is malformed.")
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    temp = None
    getter = opener or build_opener(_NoRedirects()).open
    try:
        with tempfile.NamedTemporaryFile(dir=cache, suffix=".mp3", delete=False) as file:
            temp = Path(file.name)
            request = Request(url, headers={
                "User-Agent": "HUMKIN-Autopilot/1.0",
                "Accept": "audio/mpeg, application/octet-stream",
                "Accept-Encoding": "identity"
            })
            with getter(request, timeout=35) as response:
                status = getattr(response, "status", 200)
                if status != 200:
                    raise ValueError("Remote recording did not return HTTP 200.")
                mime = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
                if mime in ("text/html", "application/json", "text/plain"):
                    raise ValueError("Remote source returned text instead of audio.")
                size_hint = response.headers.get("Content-Length")
                if size_hint and (not size_hint.isdecimal() or
                                  not 0 < int(size_hint) <= MAX_BYTES):
                    raise ValueError("Remote recording exceeds the byte limit.")
                digest = sha256()
                total = 0
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise ValueError("Remote recording exceeds the byte limit.")
                    digest.update(chunk)
                    file.write(chunk)
                if total < 1000:
                    raise ValueError("Remote recording is empty or truncated.")
                actual = digest.hexdigest()
                if expected_sha is not None and actual != expected_sha:
                    raise ValueError("Remote source SHA-256 differs from published manifest.")
        yield temp, actual
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)
