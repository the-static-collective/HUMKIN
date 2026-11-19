#!/usr/bin/env python3
"""HUMKIN live HLS bridge: launch Station One and publish short AAC/TS segments to R2.

No inbound Windows ports, web-accessible credentials, or additional database.
Uploads only complete, locally generated HLS assets under live/station-one/.
Use dedicated humkin-radio-live bucket and bucket-scoped upload credentials;
never grant the live computer write access to the permanent music archive.
"""
import argparse
import hashlib
import os
import re
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

# Also works when loaded as a module by the offline relay tests.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from now_playing import insert_cues
from hls_reservoir import air_windows, IncompleteHistory
from keep_awake import keep_awake_during_broadcast
from tower_library import DIGEST, FREQUENCY

PUBLIC_RELAY = "https://humkin-long-wave.joyvolcanomusic.workers.dev"

SEGMENT = re.compile(r"segment-[0-9]{10,16}\.ts\Z")
PREFIX = "live/station-one/"
PLAYLIST_KEY = PREFIX + "live.m3u8"
RETIRE_SECONDS = 180


def stop_requested(path, run_id):
    """Read only a matching managed-run stop request; ignore stale markers."""
    if path is None or not run_id:
        return False
    try:
        return path.read_text(encoding="utf-8").strip() == run_id
    except (OSError, UnicodeError):
        return False


class PlaylistNotReady(ValueError):
    """Valid but incomplete startup playlist; retry when more segments arrive."""


def parse_playlist(content):
    """Return safe segment filenames; reject keys, remote URIs, and partial HLS."""
    if not content.startswith("#EXTM3U\n"):
        raise ValueError("Missing HLS header")
    if any(token in content for token in ("#EXT-X-KEY:", "#EXT-X-MAP:", "#EXT-X-BYTERANGE:")):
        raise ValueError("Encrypted, initialized or byterange HLS is not supported")
    names = [line.strip() for line in content.splitlines()
             if line.strip() and not line.startswith("#")]
    if len(names) > 36 or len(set(names)) != len(names):
        raise ValueError("Live playlist requires 3-36 distinct segments")
    if not all(SEGMENT.fullmatch(name) for name in names):
        raise ValueError("Playlist has an invalid segment name")
    if len(names) < 3:
        raise PlaylistNotReady("Waiting for at least three completed HLS segments")
    return names


def rewrite_playlist(content, session):
    if not re.fullmatch(r"[0-9a-f]{32}", session):
        raise ValueError("Invalid session id")
    names = parse_playlist(content)
    remote = "\n".join(session + "/" + line if line in names else line
                       for line in content.splitlines()) + "\n"
    # Never publish a finished VOD playlist as a supposedly live station.
    remote = remote.replace("#EXT-X-ENDLIST\n", "")
    return remote.encode("utf-8"), names


def r2_client():
    """Use env-only S3 credentials; never echo their values or send them to browser."""
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    if not re.fullmatch(r"[a-fA-F0-9]{32}", account):
        raise RuntimeError("Set CLOUDFLARE_ACCOUNT_ID to the R2 account ID")
    if not os.environ.get("AWS_ACCESS_KEY_ID") or not os.environ.get("AWS_SECRET_ACCESS_KEY"):
        raise RuntimeError("Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY locally")
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:
        raise RuntimeError("Install the optional publisher dependency: py -3 -m pip install boto3") from exc
    return boto3.client("s3", endpoint_url="https://" + account + ".r2.cloudflarestorage.com",
                        region_name="auto", config=Config(
                            connect_timeout=8, read_timeout=20, retries={"max_attempts": 3},
                            s3={"addressing_style": "path"}))


class Publisher:
    def __init__(self, bucket, directory, client, session=None, now=time.monotonic,
                 frequency="station-one", tower_root=None, reservoir_seconds=0):
        self.bucket = bucket
        self.directory = Path(directory)
        self.client = client
        self.session = session or uuid.uuid4().hex
        if not re.fullmatch(r"[0-9a-f]{32}", self.session):
            raise ValueError("Invalid session id")
        self.now = now
        self.uploaded = set()
        self.retired = {}
        self.last_digest = None
        self.last_raw = None
        if not FREQUENCY.fullmatch(frequency):
            raise ValueError("Invalid frequency")
        self.prefix = f"live/{frequency}/"
        self.playlist_key = self.prefix + "live.m3u8"
        self.delayed_key = self.prefix + "delayed.m3u8"
        if (not isinstance(reservoir_seconds, int) or reservoir_seconds < 0 or
                reservoir_seconds > 600 or 0 < reservoir_seconds < 60):
            raise ValueError("Reservoir must be off or 60-600 seconds")
        self.reservoir_seconds = reservoir_seconds
        self.last_delayed_digest = None
        self.tower_root = tower_root
        self.cue_clock = {}
        self.art = {}

    def artwork(self, digest):
        if self.tower_root is None or not DIGEST.fullmatch(digest):
            return None
        filename = digest + ".jpg"
        if digest not in self.art:
            try:
                data = (self.tower_root / "media" / filename).read_bytes()
                if not 0 < len(data) <= 512 * 1024:
                    return None
                key = self.prefix + "art/" + filename
                self.client.put_object(Bucket=self.bucket, Key=key, Body=data,
                                       ContentType="image/jpeg",
                                       CacheControl="public, max-age=31536000, immutable")
            except Exception as exc:
                # R2 art is optional, even if its upload fails. Cache the
                # outcome so published, immutable daterange IDs never mutate.
                print("HLS track artwork unavailable:", type(exc).__name__, file=sys.stderr)
                self.art[digest] = None
            else:
                route = self.prefix.removeprefix("live/")
                self.art[digest] = PUBLIC_RELAY + "/hls/" + route + "art/" + filename
        return self.art[digest]

    def publish_once(self):
        index = self.directory / "index.m3u8"
        if not index.is_file():
            return False
        raw = index.read_text(encoding="utf-8")
        try:
            if self.reservoir_seconds:
                playlist, delayed, names = air_windows(
                    raw, self.session, self.reservoir_seconds)
            else:
                playlist, names = rewrite_playlist(raw, self.session)
                delayed = None
        except (PlaylistNotReady, IncompleteHistory):
            # FFmpeg publishes a 1- or 2-segment manifest at startup.
            # Waiting is normal; do not kill the encoder or leak an incomplete
            # live playlist to R2. All malformed manifests remain fatal.
            return False
        for name in names:
            if name in self.uploaded:
                continue
            part = self.directory / name
            if not part.is_file():
                # Refuse to point listeners at a not-yet-uploaded or deleted segment.
                return False
            data = part.read_bytes()
            if len(data) < 188 or data[0] != 0x47:
                raise ValueError("Incomplete MPEG-TS segment: " + name)
            key = self.prefix + self.session + "/" + name
            self.client.put_object(Bucket=self.bucket, Key=key, Body=data,
                                   ContentType="video/mp2t",
                                   CacheControl="public, max-age=31536000, immutable")
            self.uploaded.add(name)
        # Cue-only corrections matter too, even when FFmpeg has not appended a
        # new segment. Cue timestamps follow the encoded audio on BOTH clocks.
        playlist = insert_cues(playlist, self.directory, self.session,
                               self.artwork, self.cue_clock)
        digest = hashlib.sha256(playlist).hexdigest()
        if digest != self.last_digest:
            # Publish playlist LAST; every referenced segment already exists in R2.
            self.client.put_object(Bucket=self.bucket, Key=self.playlist_key, Body=playlist,
                                   ContentType="application/vnd.apple.mpegurl",
                                   CacheControl="no-store")
            self.last_digest = digest
            print("R2 LIVE: published", min(len(names), 12), "hot segments", flush=True)
        if delayed is not None:
            delayed = insert_cues(delayed, self.directory, self.session,
                                  self.artwork, self.cue_clock)
            delayed_digest = hashlib.sha256(delayed).hexdigest()
            if delayed_digest != self.last_delayed_digest:
                # Both manifests reference the SAME uploaded TS files.
                self.client.put_object(Bucket=self.bucket, Key=self.delayed_key,
                                       Body=delayed,
                                       ContentType="application/vnd.apple.mpegurl",
                                       CacheControl="no-store")
                self.last_delayed_digest = delayed_digest
                print("R2 RESERVOIR: delayed playlist updated", flush=True)
        active = set(names)
        for name in self.uploaded:
            if name not in active and name not in self.retired:
                self.retired[name] = self.now()
        for name in list(self.retired):
            if name in active:
                del self.retired[name]
            elif self.now() - self.retired[name] >= RETIRE_SECONDS:
                self.client.delete_object(Bucket=self.bucket,
                                          Key=self.prefix + self.session + "/" + name)
                self.uploaded.remove(name)
                del self.retired[name]
        self.last_raw = raw
        return True


def main(argv=None):
    p = argparse.ArgumentParser(description="HUMKIN Station One → Cloudflare R2 live HLS")
    p.add_argument("--dir", type=Path, help="Local output folder (default: private temp folder)")
    p.add_argument("--cache", type=Path, default=Path.home() / ".humkin" / "radio-cache")
    p.add_argument("--bucket", default="humkin-radio-live")
    p.add_argument("--bitrate", choices=[96, 128, 160, 192], type=int, default=96)
    p.add_argument("--seconds", type=int, default=0,
                   help="Optional limited-duration test; 0 means continuous")
    p.add_argument("--no-launch", action="store_true",
                   help="Upload from an already-running Station One HLS directory")
    p.add_argument("--stop-file", type=Path, help="Managed station stop-request file")
    p.add_argument("--run-id", help="Unique managed station run ID (32 hex chars)")
    p.add_argument("--frequency", default="station-one")
    p.add_argument("--reservoir-seconds", type=int, default=0,
                   help="LAB: publish additional 60-600s delayed playlist, public hot untouched")
    p.add_argument("--tower-root", type=Path, help="enable the Acer Tower with this shared directory")
    p.add_argument("--poll", type=float, default=1.5)
    args = p.parse_args(argv)
    if not FREQUENCY.fullmatch(args.frequency):
        p.error("Invalid frequency")
    if not 0.5 <= args.poll <= 10 or args.seconds < 0 or (args.reservoir_seconds and not 60 <= args.reservoir_seconds <= 600):
        p.error("poll must be 0.5-10 seconds and seconds nonnegative")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,62}", args.bucket):
        p.error("Invalid bucket name")
    if bool(args.stop_file) != bool(args.run_id) or (args.run_id and not re.fullmatch(r"[0-9a-f]{32}", args.run_id)):
        p.error("--stop-file and a 32-character hex --run-id must be provided together")
    # Fail before starting FFmpeg if this machine cannot publish to R2.
    client = r2_client()
    temporary = None
    if args.dir is None:
        temporary = tempfile.TemporaryDirectory(prefix="humkin-hls-")
        directory = Path(temporary.name)
    else:
        directory = args.dir.expanduser().resolve()
        directory.mkdir(parents=True, exist_ok=True)
    if (directory / "index.m3u8").exists() and not args.no_launch:
        p.error("Use an empty --dir for a new broadcast, or omit --dir")
    publisher = Publisher(args.bucket, directory, client, frequency=args.frequency,
                          tower_root=args.tower_root,
                          reservoir_seconds=args.reservoir_seconds)
    child = None
    try:
        if not args.no_launch:
            engine = Path(__file__).with_name("engine.py")
            command = [sys.executable, str(engine), "--hls-dir", str(directory),
                       "--cache", str(args.cache), "--bitrate", str(args.bitrate)]
            if args.reservoir_seconds:
                command.extend(["--hls-history-segments", "96"])
            if args.tower_root:
                command.extend(["--tower-root", str(args.tower_root), "--frequency", args.frequency])
            if args.seconds:
                command.extend(["--seconds", str(args.seconds)])
            if args.stop_file:
                command.extend(["--stop-file", str(args.stop_file), "--run-id", args.run_id])
            child = subprocess.Popen(command)
        print("HUMKIN HLS bridge armed; no listener URL is being published to the website.",
              flush=True)
        stop_since = None
        while True:
            publisher.publish_once()
            if stop_requested(args.stop_file, args.run_id):
                if stop_since is None:
                    stop_since = time.monotonic()
                    print("HUMKIN stop requested; waiting for Station One to flush its audio.", flush=True)
                if child is None:
                    return 0
                if child.poll() is None and time.monotonic() - stop_since > 60:
                    print("HUMKIN encoder did not stop within 60 seconds; terminating.", file=sys.stderr)
                    child.terminate()
            if child is not None and child.poll() is not None:
                # FFmpeg has had a chance to flush its final completed segment.
                publisher.publish_once()
                return child.returncode
            time.sleep(args.poll)
    except KeyboardInterrupt:
        print("Stopping R2 HLS uploader.", flush=True)
        return 0
    finally:
        if child is not None and child.poll() is None:
            child.terminate()
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
        if temporary is not None:
            temporary.cleanup()


if __name__ == "__main__":
    try:
        with keep_awake_during_broadcast() as guarded:
            if guarded:
                print("HUMKIN: Windows automatic system sleep blocked while broadcasting.", flush=True)
            raise SystemExit(main())
    except (OSError, RuntimeError, ValueError) as exc:
        print("HLS publisher stopped:", str(exc), file=sys.stderr)
        raise SystemExit(1)
