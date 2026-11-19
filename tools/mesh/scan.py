#!/usr/bin/env python3
"""HUMKIN MESH 001: read-only streaming inventory of any audio folder.

No network, no credentials, no uploading, no deletion. Hashes are physical file
identity; song/work identity is a separate editable editorial decision.
"""
from __future__ import annotations
import argparse
import collections
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import uuid

EXTS = {"mp3", "wav", "flac", "m4a", "aiff", "aif", "ogg", "opus", "wma", "aac"}
LAYOUT_FIELDS = {"artist", "album", "genre", "collection", "disc", "ignore"}
LIMIT_BYTES = 1024 ** 4
CHUNK = 4 * 1024 * 1024


def utcnow():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def identity_file():
    home = pathlib.Path(os.environ.get("APPDATA") or pathlib.Path.home() / ".config")
    return home / "HUMKIN" / "mesh-node.json"


def get_or_create_node():
    location = identity_file()
    if location.exists():
        record = json.loads(location.read_text(encoding="utf-8"))
        try:
            uuid.UUID(record["node_id"])
        except (KeyError, ValueError, TypeError) as exc:
            raise ValueError("Existing MESH node identity invalid; do not silently replace it") from exc
        return record["node_id"]
    location.parent.mkdir(parents=True, exist_ok=True)
    node = str(uuid.uuid4())
    payload = json.dumps({"schema": "humkin.mesh/node/v1", "node_id": node}, indent=2) + "\n"
    try:
        with location.open("x", encoding="utf-8") as f:
            f.write(payload)
    except FileExistsError:
        record = json.loads(location.read_text(encoding="utf-8"))
        node = str(uuid.UUID(record["node_id"]))
    return node


def hash_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while block := f.read(CHUNK):
            digest.update(block)
    return digest.hexdigest()


def title_from_name(name):
    stem = pathlib.Path(name).stem.strip()
    stem = re.sub(r"^\d{1,3}[\s_.\-]+", "", stem)
    stem = stem.replace("_", " ").strip()
    return stem or pathlib.Path(name).stem


def layout_fields(value):
    if value == "none":
        return []
    fields = value.lower().split("/")
    if not fields or len(fields) > 8 or any(f not in LAYOUT_FIELDS for f in fields):
        raise ValueError("Layout must use artist/album/genre/collection/disc/ignore or none")
    return fields


def metadata_from_path(relative, layout):
    folders = list(pathlib.PurePosixPath(relative).parts[:-1])
    values = {}
    # For a chosen root folder with extra grouping levels, align from the right.
    if len(folders) >= len(layout) and layout:
        for field, value in zip(layout, folders[-len(layout):]):
            if field != "ignore":
                values[field] = value
    return {"title": title_from_name(relative.rsplit("/", 1)[-1]),
            "artist": values.get("artist", ""), "album": values.get("album", "")}


def ffprobe_tags(path):
    if not shutil.which("ffprobe"):
        return {}
    try:
        result = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
            "format=duration:format_tags=title,artist,album",
            "-of", "json", str(path)],
            capture_output=True, text=True, timeout=9, check=True)
        info = json.loads(result.stdout)
        tags = {str(k).lower(): str(v) for k, v in info.get("format", {}).get("tags", {}).items()}
        duration = float(info.get("format", {}).get("duration", 0))
        return {**{key: tags[key] for key in ["title", "artist", "album"] if tags.get(key)},
                "duration_seconds": round(duration, 3) if 0 < duration <= 86400 else None}
    except (OSError, subprocess.SubprocessError, ValueError, TypeError, json.JSONDecodeError):
        return {}


def scan(root, layout="artist/album", label=None, probe=False, log=None):
    root = pathlib.Path(root).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise ValueError("The selected root is not a folder")
    fields = layout_fields(layout)
    label = (label or socket.gethostname() or "Local music computer").strip()[:120]
    if not label:
        raise ValueError("A node name is required")
    node_id = get_or_create_node()
    files = []
    total_bytes = 0
    hashes = set()
    unique_bytes = 0
    by_format = collections.Counter()
    errors = []
    for directory, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if not (pathlib.Path(directory) / d).is_symlink()]
        for name in sorted(names):
            path = pathlib.Path(directory) / name
            extension = path.suffix.lstrip(".").lower()
            if extension not in EXTS or path.is_symlink():
                continue
            try:
                size = path.stat().st_size
                if not 1 <= size <= LIMIT_BYTES:
                    errors.append(name + ": empty or exceeds one TiB guard")
                    continue
                relative = path.relative_to(root).as_posix()
                if any(not part or part in (".", "..") for part in relative.split("/")) or \
                   any(ord(char) < 32 or ord(char) == 127 for char in relative):
                    errors.append(name + ": unsupported filename")
                    continue
                sha = hash_file(path)
                meta = metadata_from_path(relative, fields)
                extra = ffprobe_tags(path) if probe else {}
                for key in ("title", "artist", "album"):
                    if extra.get(key):
                        meta[key] = extra[key]
                entry = {"sha256": sha, "path_hash": hashlib.sha256(relative.encode("utf-8")).hexdigest(),
                         "relative_path": relative, "bytes": size, "extension": extension,
                         "title": meta["title"].strip()[:240] or name[:240],
                         "artist": meta["artist"].strip()[:160],
                         "album": meta["album"].strip()[:160],
                         "duration_seconds": extra.get("duration_seconds")}
                files.append(entry)
                total_bytes += size
                by_format[extension] += 1
                if sha not in hashes:
                    unique_bytes += size
                    hashes.add(sha)
                if log and len(files) % 25 == 0:
                    log("Hashed " + str(len(files)) + " recordings · " +
                        "{:.2f}".format(total_bytes / 1024 ** 3) + " GiB examined")
            except (OSError, ValueError) as exc:
                errors.append(name + ": " + type(exc).__name__)
    files.sort(key=lambda x: x["relative_path"].casefold())
    return {"schema": "humkin.mesh/inventory/v1",
            "node_id": node_id, "label": label, "scanned_at": utcnow(),
            "layout": layout,
            "summary": {"files": len(files), "unique_hashes": len(hashes),
                        "copies_of_existing_hashes": len(files) - len(hashes),
                        "logical_bytes": total_bytes, "unique_bytes_on_node": unique_bytes,
                        "duplicate_bytes": total_bytes - unique_bytes,
                        "formats": dict(sorted(by_format.items())),
                        "errors": len(errors)},
            "errors": errors[:100],
            "files": files}


def write_atomic(destination, payload):
    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8",
                dir=destination.parent, suffix=".tmp", prefix=".humkin-mesh-",
                delete=False) as out:
            tmp_path = pathlib.Path(out.name)
            json.dump(payload, out, ensure_ascii=False, separators=(",", ":"))
            out.write("\n")
        os.replace(tmp_path, destination)
    finally:
        if tmp_path and tmp_path.exists():
            tmp_path.unlink()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Inventory an audio library without uploading music")
    parser.add_argument("--root", required=True, help="Local audio root folder")
    parser.add_argument("--layout", default="artist/album", help="e.g. artist/album, album/artist, none")
    parser.add_argument("--name", help="Label for this computer (not a public identifier)")
    parser.add_argument("--probe", action="store_true", help="Read audio tags/durations with installed ffprobe")
    parser.add_argument("--out", help="Output JSON path, default ./humkin-mesh-inventory.json")
    args = parser.parse_args(argv)
    output = pathlib.Path(args.out or "humkin-mesh-inventory.json").expanduser().resolve()
    try:
        payload = scan(args.root, args.layout, args.name, args.probe, print)
        write_atomic(output, payload)
    except (OSError, ValueError) as exc:
        parser.exit(1, "HUMKIN MESH scan failed: " + str(exc) + "\n")
    s = payload["summary"]
    print("MESH INVENTORY COMPLETE: {} files / {} unique hashes".format(s["files"], s["unique_hashes"]))
    print("Logical {:.2f} GiB / distinct {:.2f} GiB / duplicates {:.2f} GiB".format(
        s["logical_bytes"] / 1024**3, s["unique_bytes_on_node"] / 1024**3,
        s["duplicate_bytes"] / 1024**3))
    print("Manifest saved to " + str(output))
    print("NO AUDIO WAS UPLOADED, MOVED, DELETED, OR PUBLISHED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
