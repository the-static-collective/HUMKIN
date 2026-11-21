#!/usr/bin/env python3
"""Offline remote-media TOWER -> cloud preview/publish contract (no network)."""
from datetime import datetime, timezone
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
from on_air import Desk
from scheduler_v2 import StationV2
from tower_library import TowerLibrary
from autopilot_remote import published_audio_url, verified_remote_file
import autopilot_publisher as publisher
from tower_cloud_handoff import export_handoff, validate_handoff, schedule_curated, _fingerprint

SLOT = {"day": "2030-01-02", "time": "20:00"}
REMOTE_R2 = "https://media.abundent.org/music/catalogue-one.mp3"
REMOTE_ARCHIVE = "https://media.abundent.org/music/archive-two.mp3"
BYTES_R2 = b"A" * 8192
BYTES_ARCHIVE = b"B" * 12288
HASH_R2 = sha256(BYTES_R2).hexdigest()


class Response(BytesIO):
    def __init__(self, content, headers=None, status=200):
        super().__init__(content)
        self.headers = headers or {"Content-Type": "audio/mpeg", "Content-Length": str(len(content))}
        self.status = status


def station(root):
    records = [
        {"id": "r2-song-one", "title": "R2 Song", "artist": "HUMKIN",
         "duration": 84, "kind": "song", "source": "r2",
         "url": REMOTE_R2, "sha256": HASH_R2},
        {"id": "archive-song-two", "title": "Archive Song", "artist": "HUMKIN",
         "duration": 80, "kind": "song", "source": "archive",
         "url": REMOTE_ARCHIVE},
    ]
    desk = Desk(StationV2({"policy_version": 2, "tracks": records,
                           "shows": [], "settings": {}}),
                Path(root) / "station-one-programming.json",
                tower=TowerLibrary(Path(root) / "tower", "station-one"))
    desk.act({"action": "program_save", "program": {
        "name": "Remote Night", "notes": "No Acer masters",
        "track_ids": ["r2-song-one", "archive-song-two", "r2-song-one"]}})
    program = desk.view()["programs"][0]
    handoff = export_handoff(desk, {"program_id": program["id"],
                                   "revision": program["revision"], **SLOT})
    return desk, handoff


class RemoteMediaTests(unittest.TestCase):
    def test_export_remote_audio_without_any_preexisting_local_master(self):
        with tempfile.TemporaryDirectory() as directory:
            desk, packet = station(directory)
            self.assertFalse(list((Path(directory) / "tower" / "media").glob("*.mp3")))
            self.assertEqual([row["id"] for row in packet["crate"]["tracks"]],
                             ["r2-song-one", "archive-song-two", "r2-song-one"])
            self.assertTrue(all("path" not in row for row in packet["crate"]["tracks"]))
            self.assertEqual(packet["crate"]["tracks"][0]["url"], REMOTE_R2)
            self.assertEqual(packet["crate"]["tracks"][0]["expected_sha"], HASH_R2)
            self.assertNotIn("expected_sha", packet["crate"]["tracks"][1])
            self.assertEqual(validate_handoff(packet)[0], "station-one")
            self.assertEqual(desk.state["lineup"], [])

    def test_allowlisted_hosts_and_paths_only_even_with_recomputed_packet_fingerprint(self):
        self.assertEqual(published_audio_url(REMOTE_R2, "r2"), REMOTE_R2)
        self.assertEqual(published_audio_url(
            "https://humkin.abundent.org/fm/studio/recordings/voice.mp3", "static"),
            "https://humkin.abundent.org/fm/studio/recordings/voice.mp3")
        attempts = [
            ("https://media.abundent.org.evil.invalid/a.mp3", "archive"),
            ("https://media.abundent.org/a.mp3?token=123", "r2"),
            ("https://media.abundent.org:443/a.mp3", "r2"),
            ("https://user@media.abundent.org/a.mp3", "archive"),
            ("https://media.abundent.org/../private.mp3", "r2"),
            ("https://media.abundent.org/a/%2e%2e/b.mp3", "r2"),
            ("https://media.abundent.org/autopilot/segments/a.mp3", "archive"),
            ("http://media.abundent.org/a.mp3", "r2"),
            ("https://fake.invalid/a.mp3", "archive"),
            ("https://humkin.abundent.org/admin/a.mp3", "static"),
        ]
        for url, source in attempts:
            with self.subTest(url=url), self.assertRaises(ValueError):
                published_audio_url(url, source)
        with tempfile.TemporaryDirectory() as directory:
            _, packet = station(directory)
            packet["crate"]["tracks"][1]["url"] = attempts[0][0]
            packet["fingerprint"] = _fingerprint(packet)
            with self.assertRaises(ValueError):
                validate_handoff(packet)

    def test_temporary_download_verifies_bytes_and_deletes_source(self):
        with tempfile.TemporaryDirectory() as directory:
            def fetch(req, timeout):
                self.assertEqual(req.full_url, REMOTE_R2)
                self.assertEqual(req.headers["Accept-encoding"], "identity")
                return Response(BYTES_R2)
            with verified_remote_file(REMOTE_R2, "r2", directory,
                                      HASH_R2, opener=fetch) as (source, digest):
                self.assertEqual(source.read_bytes(), BYTES_R2)
                self.assertEqual(digest, HASH_R2)
                self.assertTrue(source.is_file())
            self.assertFalse(list(Path(directory).glob("*.mp3")))
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                with verified_remote_file(REMOTE_R2, "r2", directory,
                                          "0" * 64, opener=fetch):
                    pass
            self.assertFalse(list(Path(directory).glob("*.mp3")))
            with self.assertRaisesRegex(ValueError, "text instead of audio"):
                with verified_remote_file(REMOTE_R2, "r2", directory,
                                          opener=lambda *_a, **_kw:
                                          Response(BYTES_R2, {"Content-Type": "text/html"})):
                    pass
            self.assertFalse(list(Path(directory).glob("*.mp3")))

    def test_remote_preview_pins_source_publish_must_match_then_house_return(self):
        with tempfile.TemporaryDirectory() as directory:
            desk, handoff = station(directory)
            handoff_file = Path(directory) / "handoff.json"
            handoff_file.write_text(json.dumps(handoff), encoding="utf-8")
            cache = Path(directory) / "cache"
            streams = {REMOTE_R2: BYTES_R2, REMOTE_ARCHIVE: BYTES_ARCHIVE}
            count = []
            def fetch(req, timeout):
                count.append(req.full_url)
                return Response(streams[req.full_url])
            def verified(url, source, cache_dir, expected_sha=None):
                return verified_remote_file(url, source, cache_dir,
                                            expected_sha, opener=fetch)
            def transcode(src, digest, cache_dir):
                self.assertTrue(Path(src).exists())
                self.assertEqual(digest, sha256(Path(src).read_bytes()).hexdigest())
                return [8000, 8000]
            with patch.object(publisher, "verified_remote_file", side_effect=verified), \
                 patch.object(publisher, "_encoded_segments", side_effect=transcode):
                with self.assertRaisesRegex(ValueError, "Preview this remote show first"):
                    publisher.prepare_tracks(handoff_file, cache, publish=True)
                frequency, tracks = publisher.prepare_tracks(handoff_file, cache)
                self.assertEqual(frequency, "station-one")
                self.assertEqual(len(tracks), 3)
                self.assertEqual(count, [REMOTE_R2, REMOTE_ARCHIVE])
                self.assertEqual([t["id"] for t in tracks],
                                 handoff["program"]["track_ids"])
                receipt = cache / "handoffs" / (handoff["fingerprint"] + ".json")
                self.assertTrue(receipt.is_file())
                self.assertEqual(len(json.loads(receipt.read_text())["remote_tracks"]), 3)
                self.assertEqual(len(list(cache.glob("*.mp3"))), 0)
                _, again = publisher.prepare_tracks(handoff_file, cache, publish=True)
                self.assertEqual([x["asset_sha"] for x in tracks],
                                 [x["asset_sha"] for x in again])
                streams[REMOTE_ARCHIVE] = b"C" * len(BYTES_ARCHIVE)
                with self.assertRaisesRegex(ValueError, "changed since preview"):
                    publisher.prepare_tracks(handoff_file, cache, publish=True)
                self.assertEqual(len(list(cache.glob("*.mp3"))), 0)

            house_track = {"id": "home", "asset_sha": "f" * 64,
                           "durations_ms": [8000]}
            base = {"schema": "humkin.cloud-autopilot/v1", "station_id": "station-one",
                    "revisions": [{"id": "home", "effective_at":
                                   "2029-12-30T00:00:00.000Z",
                                   "tracks": [house_track]}]}
            result = schedule_curated(base, "station-one", tracks, handoff,
                                      now=datetime(2029, 12, 31, tzinfo=timezone.utc))
            self.assertEqual(result["revisions"][-2]["tracks"], tracks)
            self.assertEqual(result["revisions"][-1]["tracks"], [house_track])
            self.assertEqual(desk.state["lineup"], [])

    def test_unreviewed_plan_cannot_fetch_an_arbitrary_remote_url(self):
        with tempfile.TemporaryDirectory() as directory:
            plan = Path(directory) / "plan.json"
            plan.write_text(json.dumps({
                "schema": "humkin.autopilot.crate/v1", "station_id": "station-one",
                "tracks": [{"id": "foreign", "title": "Foreign",
                            "url": REMOTE_R2, "source_kind": "r2"}]}))
            with self.assertRaisesRegex(ValueError, "exactly one safe local"):
                publisher.prepare_tracks(plan, Path(directory) / "cache")


if __name__ == "__main__":
    unittest.main()
