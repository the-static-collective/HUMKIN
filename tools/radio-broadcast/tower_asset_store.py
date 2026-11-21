"""TOWER 011 — source-addressed, resumable AAC asset storage.

R2 media is not a mutable playlist. Each approved source SHA has immutable TS
segments and an R2 completion manifest. The completion marker is written LAST,
after every segment has been checked; a later GitHub runner can reuse it even
if no Cloud HOUSE schedule was ever published.

This module intentionally has no Supabase service role and never writes a
station's program pointer. An orphaned asset does NOT imply air eligibility.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re

BUCKET = "humkin-radio-live"
SCHEMA = "humkin.tower.aac-asset/v1"
PROFILE = "ffmpeg-aac-lc-128k-44100-stereo-hls-ts/v1"
SHA = re.compile(r"^[0-9a-f]{64}$")
MAX_MANIFEST = 110_000
MAX_SEGMENTS = 1500
MAX_SEGMENT_BYTES = 4_000_000


def key_for_manifest(digest):
    if not isinstance(digest, str) or not SHA.fullmatch(digest):
        raise ValueError("Invalid approved source digest.")
    return f"autopilot/assets/{digest}/complete.json"


def segment_key(digest, index):
    if not isinstance(digest, str) or not SHA.fullmatch(digest):
        raise ValueError("Invalid AAC segment digest.")
    if type(index) is not int or not 0 <= index < MAX_SEGMENTS:
        raise ValueError("Invalid AAC segment index.")
    return f"autopilot/segments/{digest}/segment-{index:06d}.ts"


def _not_found(error):
    response = getattr(error, "response", None)
    return isinstance(response, dict) and response.get(
        "ResponseMetadata", {}).get("HTTPStatusCode") == 404


def _get_optional(client, key):
    try:
        return client.get_object(Bucket=BUCKET, Key=key)
    except Exception as error:
        if _not_found(error):
            return None
        raise


def validate_manifest(doc, digest, expected_durations=None):
    """Validate complete-marker contract; never trust a client-supplied URL."""
    if not isinstance(doc, dict) or doc.get("schema") != SCHEMA:
        raise ValueError("Invalid R2 completion marker schema.")
    if doc.get("source_sha256") != digest or doc.get("profile") != PROFILE:
        raise ValueError("Unexpected AAC identity/encoder profile.")
    records = doc.get("segments")
    if not isinstance(records, list) or not 1 <= len(records) <= MAX_SEGMENTS:
        raise ValueError("Incomplete AAC manifest.")
    durations = []
    for index, item in enumerate(records):
        if not isinstance(item, dict) or set(item) != {"index", "milliseconds", "bytes", "sha256"}:
            raise ValueError("Malformed AAC segment receipt.")
        milliseconds, size, asset_hash = (item[k] for k in ("milliseconds", "bytes", "sha256"))
        if (item.get("index") != index or type(item["index"]) is not int or
                type(milliseconds) is not int or not 250 <= milliseconds <= 11000 or
                type(size) is not int or not 0 < size <= MAX_SEGMENT_BYTES or
                not isinstance(asset_hash, str) or not SHA.fullmatch(asset_hash)):
            raise ValueError("Invalid AAC segment receipt value.")
        durations.append(milliseconds)
    if expected_durations is not None and durations != list(expected_durations):
        raise ValueError("AAC marker contradicts the on-air source duration manifest.")
    return durations


def read_manifest(client, digest, expected_durations=None):
    """A valid marker is the persisted proof of one successfully staged asset."""
    response = _get_optional(client, key_for_manifest(digest))
    if response is None:
        return None
    raw = response["Body"].read(MAX_MANIFEST + 1)
    if len(raw) > MAX_MANIFEST:
        raise ValueError("Oversized AAC completion marker.")
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeError) as error:
        raise ValueError("Corrupt AAC completion marker.") from error
    durations = validate_manifest(value, digest, expected_durations)
    return value, durations


def _digest_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def publish_asset(client, digest, durations, cache, workers=8):
    """Stage segments in parallel, then commit a durable marker.

    Existing partial uploads are compared BYTE-FOR-BYTE by checksum against
    current encoding before reuse. Never overwrite incompatible SHA paths.
    Safe to retry after a crash: the manifest is absent until all succeeded.
    """
    prior = read_manifest(client, digest, expected_durations=durations)
    if prior is not None:
        return {"state": "reused", "segments": len(durations), "new_uploads": 0}
    if not isinstance(durations, list) or not 1 <= len(durations) <= MAX_SEGMENTS:
        raise ValueError("Invalid AAC duration list.")
    base = Path(cache) / digest
    local_receipts = []
    for i, milliseconds in enumerate(durations):
        if type(milliseconds) is not int or not 250 <= milliseconds <= 11000:
            raise ValueError("Invalid AAC segment duration.")
        file = base / f"segment-{i:06d}.ts"
        if not file.is_file():
            raise FileNotFoundError("Missing encoded AAC segment before durable write.")
        size = file.stat().st_size
        if not 0 < size <= MAX_SEGMENT_BYTES:
            raise ValueError("Unusable encoded AAC segment size.")
        local_receipts.append({"index": i, "milliseconds": milliseconds,
                               "bytes": size, "sha256": _digest_file(file)})

    def stage(item):
        index, size, expected_sha = (item[k] for k in ("index", "bytes", "sha256"))
        key = segment_key(digest, index)
        local = base / f"segment-{index:06d}.ts"
        try:
            head = client.head_object(Bucket=BUCKET, Key=key)
        except Exception as error:
            if not _not_found(error):
                raise
            client.upload_file(str(local), BUCKET, key, ExtraArgs={
                "ContentType": "video/mp2t",
                "CacheControl": "public, max-age=31536000, immutable"})
            head = client.head_object(Bucket=BUCKET, Key=key)
            if head.get("ContentLength") != size:
                raise ValueError("Uploaded AAC segment size did not verify.")
            return 1
        if head.get("ContentLength") != size:
            raise ValueError("Old AAC segment conflicts with current encoder bytes.")
        body = client.get_object(Bucket=BUCKET, Key=key)["Body"].read(size + 1)
        if len(body) != size or hashlib.sha256(body).hexdigest() != expected_sha:
            raise ValueError("Old AAC segment checksum mismatch: refuse overwrite.")
        return 0

    # Uploaded pieces are harmless if another track later fails. The marker
    # appears only after *every* piece succeeds. The loop emits progress.
    with ThreadPoolExecutor(max_workers=min(max(1, int(workers)), 12)) as pool:
        uploaded = sum(pool.map(stage, local_receipts))
    manifest = {"schema": SCHEMA, "profile": PROFILE,
                "source_sha256": digest, "segments": local_receipts}
    data = json.dumps(manifest, ensure_ascii=False, separators=(",", ":")).encode()
    if len(data) > MAX_MANIFEST:
        raise ValueError("AAC completion marker exceeds limit.")
    other = read_manifest(client, digest, expected_durations=durations)
    if other is not None:
        if other[0] != manifest:
            raise ValueError("Concurrent AAC manifest disagrees; HOLD.")
        return {"state": "reused", "segments": len(durations),
                "new_uploads": uploaded}
    client.put_object(Bucket=BUCKET, Key=key_for_manifest(digest), Body=data,
                      ContentType="application/json", CacheControl="private, no-store")
    checked = read_manifest(client, digest, expected_durations=durations)
    if checked is None or checked[0] != manifest:
        raise ValueError("AAC completion marker was not durable.")
    return {"state": "persisted", "segments": len(durations),
            "new_uploads": uploaded}


def verify_stored_segments(client, digest, manifest):
    """Cheap preflight after a prior atomic marker, not 20–40 HEADs per song.

    Verifies the first and last segment still exist with recorded sizes.
    Cloud Worker separately verifies all segments in its live HLS window.
    """
    durations = validate_manifest(manifest, digest)
    records = manifest["segments"]
    for i in sorted({0, len(durations) - 1}):
        head = client.head_object(Bucket=BUCKET, Key=segment_key(digest, i))
        if head.get("ContentLength") != records[i]["bytes"]:
            raise ValueError("AAC segment missing or mutated after completion.")
    return durations
