#!/usr/bin/env python3
"""No-network HOUSE selection, preview, pinning and approval-revocation tests."""
from contextlib import contextmanager
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1] / "tools" / "radio-broadcast"
sys.path.insert(0, str(ROOT))
from house_rotation import accepted_row, make_selection, validate_selection, crate_from_selection, fingerprint
import house_rotation
import autopilot_publisher as publisher


def source_rows():
    result = []
    for i in range(7):
        ident = f"00000000-0000-4000-8000-{i:012d}"
        data = bytes([65 + i]) * (4096 + i * 512)
        digest = sha256(data).hexdigest()
        result.append({
            "id": ident, "sha256": digest,
            "r2_object_key": f"tracks/{ident}/{digest}.mp3",
            "title": f"Actual approved track {i}",
            "artist": "Daughter's Home" if i % 2 else "HUMKIN",
            "album": "HUMKIN RADIO · INBOX",
            "duration_seconds": 160 + i * 2,
            "published_at": "2026-11-20T04:00:00+00:00",
            "enabled": True, "kind": "song", "storage_provider": "r2",
            "_bytes": data,
        })
    return result


def clean_rows(rows):
    return [{k: v for k, v in row.items() if k != "_bytes"} for row in rows]


class CloudHouseRotationTest(unittest.TestCase):
    def setUp(self):
        self.sources = source_rows()
        self.rows = clean_rows(self.sources)
        self.payload = make_selection(self.rows, count=5)

    def test_selects_approved_unique_published_media_for_reproducible_house(self):
        self.assertEqual(self.payload, make_selection(self.rows, count=5))
        self.assertEqual(validate_selection(self.payload, self.rows), "station-one")
        songs = self.payload["tracks"]
        self.assertEqual(len(songs), 5)
        self.assertEqual(len({s["id"] for s in songs}), 5)
        self.assertGreater(len({s["artist"] for s in songs}), 1)
        self.assertEqual(self.payload["fingerprint"], fingerprint(self.payload))
        self.assertEqual(self.payload["state"], "draft_for_owner_review")
        self.assertFalse(any("path" in song or "url" in song for song in songs))
        crate = crate_from_selection(self.payload)
        self.assertEqual(crate["schema"], "humkin.autopilot.crate/v1")
        self.assertEqual(crate["station_id"], "station-one")
        for item in crate["tracks"]:
            self.assertNotIn("path", item)
            self.assertTrue(item["url"].startswith("https://media.abundent.org/tracks/"))
            self.assertEqual(item["source_kind"], "r2")
            self.assertEqual(len(item["expected_sha"]), 64)

    def test_larger_house_reaches_all_three_artists_with_catalog_proportions(self):
        library = []
        for family, (artist, quantity) in enumerate((
                ("HUMKIN", 113), ("Hailey Lu", 82), ("Daughter's Home", 38))):
            for slot in range(quantity):
                uid = f"{family + 1:08x}-0000-4000-8000-{slot:012d}"
                digest = sha256(uid.encode()).hexdigest()
                library.append({
                    "id": uid, "sha256": digest,
                    "r2_object_key": f"tracks/{uid}/{digest}.mp3",
                    "title": f"{artist} song {slot}", "artist": artist,
                    "album": "HUMKIN RADIO",
                    "duration_seconds": 180, "enabled": True,
                    "published_at": "2026-11-21T00:00:00+00:00",
                    "kind": "song", "storage_provider": "r2",
                })
        result = make_selection(library, count=40)
        self.assertEqual(result, make_selection(list(reversed(library)), count=40))
        counts = {artist: sum(song["artist"] == artist for song in result["tracks"])
                  for artist in ("HUMKIN", "Hailey Lu", "Daughter's Home")}
        self.assertEqual(sum(counts.values()), 40)
        self.assertGreaterEqual(counts["HUMKIN"], 17)
        self.assertGreaterEqual(counts["Hailey Lu"], 12)
        self.assertGreaterEqual(counts["Daughter's Home"], 5)
        self.assertEqual(len(set(song["id"] for song in result["tracks"])), 40)
        self.assertTrue(all(
            result["tracks"][i]["artist"] != result["tracks"][i-1]["artist"]
            for i in range(1, len(result["tracks"]))
        ))
        self.assertEqual(validate_selection(result, library), "station-one")

    def test_rejects_unsigned_edits_duplicates_and_revoked_publication(self):
        dirty = json.loads(json.dumps(self.payload))
        dirty["tracks"][0]["title"] = "Wrong title"
        with self.assertRaisesRegex(ValueError, "changed"):
            validate_selection(dirty, self.rows)
        dirty["fingerprint"] = fingerprint(dirty)
        with self.assertRaisesRegex(ValueError, "eligibility or source metadata changed"):
            validate_selection(dirty, self.rows)
        dirty = json.loads(json.dumps(self.payload))
        dirty["tracks"][1] = dirty["tracks"][0]
        dirty["fingerprint"] = fingerprint(dirty)
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            validate_selection(dirty, self.rows)
        revoked = json.loads(json.dumps(self.rows))
        chosen = self.payload["tracks"][0]["id"]
        next(row for row in revoked if row["id"] == chosen)["enabled"] = False
        with self.assertRaises(ValueError):
            validate_selection(self.payload, revoked)

    def test_untrusted_keys_are_not_promoted_to_public_audio_urls(self):
        wrong = dict(self.rows[0])
        wrong["r2_object_key"] = "autopilot/programs/station-one.json"
        self.assertIsNone(accepted_row(wrong))
        wrong["r2_object_key"] = self.rows[0]["r2_object_key"] + "?token=leak"
        self.assertIsNone(accepted_row(wrong))
        wrong["r2_object_key"] = self.rows[0]["r2_object_key"]
        wrong["storage_provider"] = "unknown"
        self.assertIsNone(accepted_row(wrong))
        with self.assertRaisesRegex(ValueError, "Not enough"):
            make_selection([wrong], count=2)

    def test_preview_then_publish_only_with_same_public_bytes_and_source_receipt(self):
        lookup = {row["sha256"]: row["_bytes"] for row in self.sources}
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            manifest=root/"house.json"
            manifest.write_text(json.dumps(self.payload), encoding="utf-8")
            cache=root/"cache"

            @contextmanager
            def download(url, source, folder, expected_sha=None):
                self.assertEqual(source, "r2")
                self.assertIn(expected_sha, lookup)
                self.assertTrue(url.endswith(expected_sha + ".mp3"))
                target=Path(folder)/"transient-source.mp3"
                target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes(lookup[expected_sha])
                try:
                    yield target, sha256(target.read_bytes()).hexdigest()
                finally:
                    target.unlink(missing_ok=True)

            def encode(file, digest, folder):
                self.assertTrue(Path(file).is_file())
                self.assertEqual(sha256(Path(file).read_bytes()).hexdigest(), digest)
                return [8000, 8000]

            with patch.object(house_rotation, "catalog_rows", return_value=self.rows), \
                 patch.object(publisher, "verified_remote_file", side_effect=download), \
                 patch.object(publisher, "_encoded_segments", side_effect=encode):
                with self.assertRaisesRegex(ValueError,"Preview this remote show first"):
                    publisher.prepare_tracks(manifest, cache, publish=True)
                frequency, preview = publisher.prepare_tracks(manifest, cache)
                self.assertEqual(frequency, "station-one")
                self.assertEqual(len(preview), 5)
                receipt=cache/"handoffs"/(self.payload["fingerprint"]+".json")
                self.assertTrue(receipt.is_file())
                self.assertEqual(len(json.loads(receipt.read_text())["remote_tracks"]),5)
                self.assertFalse(list(cache.glob("*.mp3")))
                _, confirmed=publisher.prepare_tracks(manifest, cache, publish=True)
                self.assertEqual(preview, confirmed)

                revoked = json.loads(json.dumps(self.rows))
                chosen = self.payload["tracks"][0]["id"]
                next(row for row in revoked if row["id"] == chosen)["enabled"] = False
                with patch.object(house_rotation,"catalog_rows",return_value=revoked):
                    with self.assertRaisesRegex(ValueError, "eligibility or source metadata changed"):
                        publisher.prepare_tracks(manifest, cache, publish=True)
                self.assertFalse(list(cache.glob("*.mp3")))

    def test_short_final_hls_tail_retries_without_relaxing_segment_contract(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            digest = "b" * 64
            src = root / "synthetic.mp3"
            src.write_bytes(b"fake-source")
            calls = []

            def fake_encode(command, check):
                self.assertTrue(check)
                seconds = command[command.index("-hls_time") + 1]
                calls.append(seconds)
                directory = root / digest
                manifest = directory / "track.m3u8"
                durations = [8000, 8000, 80] if seconds == "8" else [7600, 7600, 880]
                for n, duration in enumerate(durations):
                    (directory / f"segment-{n:06d}.ts").write_bytes(b"G" * 188)
                manifest.write_text("#EXTM3U\n" + "".join(
                    f"#EXTINF:{duration / 1000:.3f},\nsegment-{n:06d}.ts\n"
                    for n, duration in enumerate(durations)
                ) + "#EXT-X-ENDLIST\n", encoding="utf-8")

            with patch.object(publisher.subprocess, "run", side_effect=fake_encode):
                durations = publisher._encoded_segments(src, digest, root)
                self.assertEqual(durations, [7600, 7600, 880])
                self.assertEqual(calls, ["8", "7.6"])
                # A valid cache is reusable without reencoding.
                self.assertEqual(publisher._encoded_segments(src, digest, root), durations)
                self.assertEqual(calls, ["8", "7.6"])
            self.assertTrue(all(250 <= duration <= 11000 for duration in durations))

    def test_missing_or_tiny_middle_segment_still_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            manifest = directory / "track.m3u8"
            for n in range(3):
                (directory / f"segment-{n:06d}.ts").write_bytes(b"G" * 188)
            manifest.write_text(
                "#EXTM3U\n#EXTINF:8.000,\nsegment-000000.ts\n"
                "#EXTINF:0.080,\nsegment-000001.ts\n"
                "#EXTINF:7.500,\nsegment-000002.ts\n",
                encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Invalid AAC segment duration"):
                publisher.segments_from_manifest(manifest, directory)
            (directory / "segment-000002.ts").unlink()
            with self.assertRaisesRegex(ValueError, "Invalid/missing AAC segment"):
                publisher.segments_from_manifest(manifest, directory)

    def test_house_publication_schedules_at_old_song_boundary(self):
        tracks=[{"id":"r2-"+song["id"], "title":song["title"], "artist":song["artist"],
                 "album":song["album"], "artwork":"", "asset_sha":song["sha256"],
                 "durations_ms":[8000,8000]} for song in self.payload["tracks"]]
        old=[{"id":"old", "title":"Existing safe house", "artist":"HUMKIN",
              "album":"", "artwork":"", "asset_sha":"f"*64, "durations_ms":[8000,8000]}]
        existing={"schema":"humkin.cloud-autopilot/v1","station_id":"station-one",
                  "revisions":[{"id":"r-before", "effective_at":"2026-11-19T00:00:00.000Z","tracks":old}]}
        with patch.object(publisher, "utcnow",return_value=datetime(2026,11,20,tzinfo=timezone.utc)):
            new=publisher.public_program(existing,"station-one",tracks)
        self.assertEqual(len(existing["revisions"]),1)
        self.assertEqual(len(new["revisions"]),2)
        self.assertEqual(new["revisions"][-1]["tracks"],tracks)
        from autopilot_publisher import clock_ms
        self.assertEqual((clock_ms(new["revisions"][-1]["effective_at"]) -
                          clock_ms(existing["revisions"][0]["effective_at"])) % 16000, 0)


if __name__ == "__main__":
    unittest.main()
