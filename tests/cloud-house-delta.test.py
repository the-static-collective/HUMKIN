#!/usr/bin/env python3
"""No-network acceptance for automatic, owner-approved Cloud HOUSE delta encoding."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1] / "tools" / "radio-broadcast"
sys.path.insert(0, str(ROOT))
import house_rotation
import cloud_house_sync as syncer
import autopilot_publisher as publisher


def rows():
    items = []
    for i in range(8):
        uid = f"10000000-0000-4000-8000-{i:012d}"
        digest = sha256(uid.encode()).hexdigest()
        items.append({
            "id": uid, "sha256": digest, "r2_object_key": f"tracks/{uid}/{digest}.mp3",
            "title": f"Published Song {i}", "artist": ["HUMKIN", "Hailey Lu"][i%2],
            "album": "INBOX", "is_single": (i==2),
            "duration_seconds": 180., "kind": "song", "enabled": True,
            "published_at": "2026-11-21T01:00:00+00:00", "storage_provider": "r2"
        })
    for i in range(2):
        uid = f"20000000-0000-4000-8000-{i:012d}"
        digest = sha256(uid.encode()).hexdigest()
        items.append({
            "id": uid, "sha256": digest, "r2_object_key": f"tracks/{uid}/{digest}.mp3",
            "title": f"Station Short {i}", "artist": "HUMKIN",
            "album": "CARTS", "duration_seconds": 8.0+i,
            "kind": "bumper", "enabled": True,
            "published_at": "2026-11-21T01:00:00+00:00", "storage_provider": "r2"
        })
    return items


SETTINGS = {"bumper_every": 4, "bumper_rules": [], "bumper_groups": []}
BUMPERS = {"short_max_seconds": 19, "medium_max_seconds": 60, "feature_only_spoken_sha256s": []}
ROTATION = {"featured_rotation": {"multiplier": 2, "albums": [], "singles": []},
            "seasonal_rotation": {"multiplier": 3, "sha256s": [], "track_ids": []}}


class ReadCloud:
    def __init__(self, program):
        self.program = program
        self.reads = 0

    def get_object(self, Bucket, Key):
        self.reads += 1
        assert Bucket == "humkin-radio-live" and Key == "autopilot/programs/station-one.json"
        return {"Body": BytesIO(json.dumps(self.program).encode())}


def existing_program(tracks, *, when=None):
    when = when or (datetime.now(timezone.utc) - timedelta(days=2))
    return {"schema": publisher.SCHEMA, "station_id": "station-one",
            "revisions": [{"id": "existing", "effective_at": publisher.iso(when),
                           "tracks": tracks}]}


class CloudHouseDeltaTest(unittest.TestCase):
    def setUp(self):
        self.rows = rows()
        self.settings = patch.object(house_rotation, "public_bumper_settings",
                                     return_value=SETTINGS)
        self.bumpers = patch.object(house_rotation, "local_bumper_policy",
                                    return_value=BUMPERS)
        self.rotation = patch.object(house_rotation, "local_rotation_policy",
                                     return_value=ROTATION)
        self.settings.start()
        self.bumpers.start()
        self.rotation.start()
        self.addCleanup(self.settings.stop)
        self.addCleanup(self.bumpers.stop)
        self.addCleanup(self.rotation.stop)
        self.chosen = house_rotation.make_selection(self.rows, count="FULL")

    def test_delta_reuses_previous_content_hash_and_never_encodes_repeats(self):
        # A tiny existing on-air history already contains two approved songs.
        published = [
            {"id": f"r2-{r['id']}", "title": r["title"],
             "artist": r["artist"], "album": r["album"], "artwork": "",
             "asset_sha": r["sha256"], "durations_ms": [8000, 8000]}
            for r in self.rows[:2]
        ]
        old = existing_program(published)
        calls = []

        @contextmanager
        def downloader(url, source, cache, expected_sha=None):
            self.assertEqual(source, "r2")
            self.assertTrue(url.endswith("/"+expected_sha+".mp3"))
            calls.append(expected_sha)
            yield Path("/tmp/verified-audio.mp3"), expected_sha

        def encode(temp, digest, cache):
            self.assertIn(digest, calls)
            return [8000, 8000]

        with tempfile.TemporaryDirectory() as cache:
            tracks, data = syncer.prepare_delta(self.chosen, old, cache,
                                                 downloader=downloader, encode=encode)
        unique = set(r["sha256"] for r in self.chosen["tracks"])
        self.assertEqual(len(tracks), len(self.chosen["tracks"]))
        self.assertEqual(data["new_source_encodes"], len(unique)-2)
        self.assertEqual(data["reused_source_encodes"], 2)
        self.assertEqual(len(calls), len(unique)-2)
        self.assertEqual(set(calls), unique-{r["sha256"] for r in self.rows[:2]})
        self.assertEqual(data["segments"], 2*len(tracks))
        self.assertEqual(len({r["asset_sha"] for r in tracks}),len(unique))

    def test_published_order_only_republishes_if_new_approved_catalog_changed(self):
        items = [
            {"id": "r2-"+t["id"], "title": t["title"],
             "artist": t["artist"], "album": t["album"],
             "artwork": "", "asset_sha": t["sha256"], "durations_ms": [8000]}
            for t in self.chosen["tracks"]
        ]
        old = existing_program(items)
        self.assertFalse(syncer.needs_refresh(self.chosen, old))
        read = ReadCloud(old)
        with tempfile.TemporaryDirectory() as cache:
            with patch.object(syncer, "prepare_delta", side_effect=AssertionError("must skip encoding")):
                receipt = syncer.sync(client=read,cache=cache,selection=self.chosen,
                                      read_catalog=lambda:self.rows,commit=True)
        self.assertEqual(receipt["state"], "unchanged")
        self.assertEqual(read.reads, 1)
        changed = json.loads(json.dumps(self.chosen))
        changed["tracks"][0]["title"] = "A different approved song"
        self.assertTrue(syncer.needs_refresh(changed, old))

    def test_revocation_or_owner_policy_change_fails_before_media_or_pointer(self):
        read = ReadCloud(existing_program([{"id":"old","title":"Old","artist":"HUMKIN",
            "album":"","artwork":"","asset_sha":"a"*64,"durations_ms":[8000]}]))
        modified = json.loads(json.dumps(self.rows))
        modified[0]["enabled"] = False
        with tempfile.TemporaryDirectory() as cache:
            with patch.object(syncer, "prepare_delta", side_effect=AssertionError("no encoding")):
                with self.assertRaisesRegex(ValueError, "changed|strict source validation"):
                    syncer.sync(client=read,cache=cache,selection=self.chosen,
                                read_catalog=lambda:modified,commit=True)
        self.assertEqual(read.reads,0)

    def test_future_manual_program_holds_automatic_refresh(self):
        future = existing_program([{"id":"prior","title":"Prior","artist":"HUMKIN",
            "album":"","artwork":"","asset_sha":"b"*64,"durations_ms":[8000]}],
            when=datetime.now(timezone.utc)+timedelta(days=1))
        with self.assertRaisesRegex(ValueError,"future"):
            syncer.needs_refresh(self.chosen,future)

    def test_incremental_sync_rechecks_catalog_then_schedules_at_boundary(self):
        original = [{"id":"prior","title":"Prior","artist":"HUMKIN","album":"",
                     "artwork":"","asset_sha":"a"*64,"durations_ms":[8000]}]
        client=ReadCloud(existing_program(original))
        available=lambda:self.rows
        with tempfile.TemporaryDirectory() as cache:
            with patch.object(syncer,"prepare_delta",return_value=(
                [{"id":"r2-"+r["id"],"title":r["title"],"artist":r["artist"],
                  "album":r["album"],"artwork":"","asset_sha":r["sha256"],
                  "durations_ms":[8000]} for r in self.chosen["tracks"]],
                {"new_source_encodes":8,"reused_source_encodes":1,"program_entries":11,"segments":11})),\
                 patch.object(syncer,"publish_program") as publish:
                receipt = syncer.sync(client=client,cache=cache,selection=self.chosen,
                                      read_catalog=available,commit=True)
                publish.assert_called_once()
                program=publish.call_args.args[0]
        self.assertEqual(receipt["state"],"published")
        self.assertEqual(program["revisions"][-1]["tracks"][0]["id"],
                         "r2-"+self.chosen["tracks"][0]["id"])
        self.assertEqual(len(program["revisions"]),2)
        self.assertGreater(client.reads,1)


if __name__ == "__main__":
    unittest.main()
