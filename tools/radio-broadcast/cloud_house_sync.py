#!/usr/bin/env python3
"""Incremental, owner-authorized HUMKIN Cloud HOUSE refresh.

Published+enabled R2 sources and the canonical Bumper Brain are the *only*
program inputs. Already-on-air hashes reuse their encoded segment durations;
new source hashes are verified against public audio and transcoded on demand.
Media-first / pointer-last upload is delegated to autopilot_publisher.
No R2 writes occur in read-only mode, and no hidden catalog picks are allowed.
"""
import argparse
from collections import defaultdict
import json
from pathlib import Path
import re
import sys

from autopilot_remote import verified_remote_file
from autopilot_publisher import (BUCKET, SCHEMA, _encoded_segments,
                                  public_program, publish_program,
                                  validate_hosted_program, utcnow)
from catalog_sources import r2_public_url
from house_rotation import (FULL, catalog_rows, make_selection,
                            validate_selection)

SHA = re.compile(r"^[0-9a-f]{64}$")
SEGMENT_LIMIT = 10000


def encoded_sources(existing, station):
    """Read prior approved cloud *output*, never a client-supplied cache map."""
    if existing is None:
        return {}
    if existing.get("schema") != SCHEMA or existing.get("station_id") != station:
        raise ValueError("Existing cloud program is not an authorized HOUSE.")
    validate_hosted_program(existing)
    output = {}
    for revision in existing["revisions"]:
        for track in revision["tracks"]:
            digest = track["asset_sha"]
            if not isinstance(digest, str) or not SHA.fullmatch(digest):
                raise ValueError("Malformed previously published asset SHA.")
            durations = track["durations_ms"]
            if digest in output and output[digest] != durations:
                raise ValueError("Published AAC segment metadata disagrees for one content hash.")
            output[digest] = durations[:]
    return output


def selected_identity(selection):
    """Compare exact music/carts/credits/ordering, not just song count."""
    return [
        (f"r2-{record['id']}", record["sha256"], record["title"],
         record["artist"], record["album"])
        for record in selection["tracks"]
    ]


def published_identity(existing):
    if not existing:
        return []
    return [
        (record["id"], record["asset_sha"], record["title"],
         record["artist"], record["album"])
        for record in existing["revisions"][-1]["tracks"]
    ]


def needs_refresh(selection, existing, now=None):
    """A pending show never gets silently displaced or delayed."""
    if existing is None:
        return True
    if existing.get("schema") != SCHEMA or existing.get("station_id") != selection["station_id"]:
        raise ValueError("Incompatible published station; HOLD.")
    validate_hosted_program(existing)
    from autopilot_publisher import parse_time
    instant = now or utcnow()
    if any(parse_time(revision["effective_at"]) > instant
           for revision in existing["revisions"]):
        raise ValueError("Cloud HOUSE has a future feature/revision; HOLD refresh.")
    return selected_identity(selection) != published_identity(existing)


def prepare_delta(selection, existing, cache, *, downloader=verified_remote_file,
                  encode=_encoded_segments):
    """Verify/encode new source hashes; reuse previously published AAC hashes."""
    cache = Path(cache)
    prior = encoded_sources(existing, selection["station_id"])
    result = []
    new = reused = 0
    seen = {}
    for row in selection["tracks"]:
        digest = row["sha256"]
        if not isinstance(digest, str) or not SHA.fullmatch(digest):
            raise ValueError("Unapproved source checksum in selection.")
        if digest in seen:
            durations = seen[digest]
        elif digest in prior:
            durations = prior[digest][:]
            seen[digest] = durations
            reused += 1
        else:
            # No source URLs from a phone, webhook, or proposed feature are
            # accepted here; only validated content-addressed catalog keys.
            url = r2_public_url(row["r2_object_key"])
            if not url:
                raise ValueError("Not a canonical published R2 recording.")
            with downloader(url, "r2", cache, expected_sha=digest) as (temp, verified):
                if verified != digest:
                    raise ValueError("Source recording hash changed during fetch.")
                durations = encode(temp, digest, cache)
            seen[digest] = durations
            new += 1
        result.append({
            "id": "r2-" + row["id"], "title": row["title"],
            "artist": row["artist"], "album": row["album"],
            "artwork": "", "asset_sha": digest,
            "durations_ms": list(durations),
        })
    if not 1 <= len(result) <= 500:
        raise ValueError("HOUSE exceeds 500 audio entries: hold and build a rolling-window policy.")
    total_segments = sum(len(track["durations_ms"]) for track in result)
    if total_segments > SEGMENT_LIMIT:
        raise ValueError("HOUSE exceeds 10,000 HLS segments; HOLD before any R2 write.")
    return result, {"new_source_encodes": new, "reused_source_encodes": reused,
                    "program_entries": len(result), "segments": total_segments}


def read_cloud(client, station):
    """Read existing pointer only; fail on errors other than object not found."""
    key = f"autopilot/programs/{station}.json"
    try:
        item = client.get_object(Bucket=BUCKET, Key=key)
    except Exception as error:
        # Only boto3-compatible object-not-found is an absent program.
        # Auth failures, timeouts and unexpected exceptions must fail closed.
        response = getattr(error, "response", None)
        status = response.get("ResponseMetadata", {}).get("HTTPStatusCode") if isinstance(response, dict) else None
        if status != 404:
            raise
        return None
    return json.loads(item["Body"].read())


def plan(rows=None):
    catalog = catalog_rows() if rows is None else rows
    selection = make_selection(catalog, count=FULL, station="station-one")
    validate_selection(selection, catalog)
    return selection


def sync(*, client, cache, selection=None, read_catalog=catalog_rows,
         downloader=verified_remote_file, encode=_encoded_segments, commit=False):
    """Single-flight coordinator; use protected GitHub Actions concurrency."""
    current_rows = read_catalog()
    chosen = selection or plan(current_rows)
    validate_selection(chosen, current_rows)
    old = read_cloud(client, chosen["station_id"])
    if not needs_refresh(chosen, old):
        return {"state": "unchanged", "fingerprint": chosen["fingerprint"],
                "entries": len(chosen["tracks"])}
    tracks, counts = prepare_delta(chosen, old, cache,
                                   downloader=downloader, encode=encode)
    from autopilot_publisher import parse_time
    if old and len(old["revisions"]) >= 32:
        raise ValueError("Cloud revision history is full; HOLD pending continuity-safe compaction.")
    # Approval may have changed during a long encode: refresh eligibility,
    # including per-record rights and the repo-owned policy, before publishing.
    latest = read_catalog()
    validate_selection(chosen, latest)
    if not needs_refresh(chosen, read_cloud(client, chosen["station_id"])):
        return {"state": "unchanged", "fingerprint": chosen["fingerprint"],
                "entries": len(chosen["tracks"])}
    program = public_program(old, chosen["station_id"], tracks, lead_seconds=180)
    validate_hosted_program(program)
    if commit:
        # publish_program re-HEADs every referenced TS segment and refuses a
        # changed current R2 pointer; it uploads immutable media before JSON.
        publish_program(program, Path(cache), client, new_revision_count=1)
    return {**counts, "state": "published" if commit else "preview",
            "fingerprint": chosen["fingerprint"],
            "revision": program["revisions"][-1]["id"],
            "effective_at": program["revisions"][-1]["effective_at"]}


def main():
    parser = argparse.ArgumentParser(description="Refresh only changed owner-approved HUMKIN Cloud HOUSE media.")
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--sync", action="store_true",
                        help="Publish approved catalog to Cloud HOUSE (only after action gates pass)")
    args = parser.parse_args()
    selection = plan()
    print("Approved catalog:", selection["song_count"], "songs,",
          selection["weighted_song_slots"], "weighted music slots,",
          selection["bumper_break_count"], "bumper appearances")
    if not args.sync:
        print("READ ONLY: review fingerprint", selection["fingerprint"])
        print("No R2 credentials required and no media/schedule written.")
        return
    from hls_push import r2_client
    receipt = sync(client=r2_client(), cache=args.cache, selection=selection, commit=True)
    print("CLOUD HOUSE SYNC RECEIPT:", json.dumps(receipt, sort_keys=True))
    if receipt["state"] == "published":
        print("Media-first, pointer-last R2 program update complete.")
    else:
        print("Already current: no R2 program mutation.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError) as error:
        print("CLOUD HOUSE HOLD:", error, file=sys.stderr)
        sys.exit(1)
