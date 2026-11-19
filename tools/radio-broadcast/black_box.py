#!/usr/bin/env python3
"""Local-only source flight recorder; track IDs and enum decisions, never URLs/secrets."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

EVENTS = {"source_select", "boundary", "audio_error", "stream_error", "reconnect"}
MODES = {"stream", "clock", "shuffle", "album"}
KINDS = {"song", "bumper", "stream"}
REASONS = {"automatic", "operator_skip", "source_error", "encoder", "reconnect", "unknown"}
MAX_BYTES = 5 * 1024 * 1024


def sanitized(detail):
    value = {}
    if not isinstance(detail, dict):
        return value
    for name in ("track_id", "next_track_id"):
        entry = detail.get(name)
        if isinstance(entry, str) and 1 <= len(entry) <= 96 and all(
                c.isascii() and (c.isalnum() or c in "_-") for c in entry):
            value[name] = entry
    for name, allowed in (("mode", MODES), ("kind", KINDS), ("reason", REASONS)):
        if detail.get(name) in allowed:
            value[name] = detail[name]
    for name in ("cycle", "audio_code"):
        number = detail.get(name)
        if isinstance(number, int) and not isinstance(number, bool) and 0 <= number < 100000000:
            value[name] = number
    return value


class BlackBox:
    def __init__(self, path):
        self.path = Path(path).expanduser().resolve()

    def record(self, event, detail=None):
        if event not in EVENTS:
            return False
        line = json.dumps({
            "schema": "humkin.radio.blackbox/v1", "source": "python",
            "at": datetime.now(timezone.utc).isoformat(),
            "event": event, **sanitized(detail)
        }, separators=(",", ":")) + "\n"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.is_file() and self.path.stat().st_size >= MAX_BYTES:
            previous = self.path.with_name(self.path.name + ".previous")
            self.path.replace(previous)
        # Private permissions on POSIX, append-only; best-effort on Windows.
        fd = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        try:
            os.write(fd, line.encode("utf-8"))
        finally:
            os.close(fd)
        return True
