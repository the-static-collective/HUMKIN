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
        revoked[0]["enabled"] = False
        revoked[1]["published_at"] = None
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
                revoked[0]["enabled"]=False
                with patch.object(house_rotation,"catalog_rows",return_value=revoked):
                    with self.assertRaisesRegex(ValueError, "eligibility or source metadata changed"):
                        publisher.prepare_tracks(manifest, cache, publish=True)
                self.assertFalse(list(cache.glob("*.mp3")))

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
