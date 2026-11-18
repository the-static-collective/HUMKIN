#!/usr/bin/env python3
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1] / "tools" / "radio-broadcast"
sys.path.insert(0, str(TOOLS))
from station_lab import simulate, compare, inspect_receiver
from black_box import BlackBox

def fixture():
    songs = [{"id": "song-" + str(i), "title": "Song " + str(i),
              "artist": "HUMKIN", "album": "RELEASE" if i < 6 else "INBOX",
              "kind": "song", "duration": 180} for i in range(12)]
    bumpers = [{"id": "cart-a", "title": "Good company", "kind": "bumper", "duration": 9},
               {"id": "cart-b", "title": "Radio ID", "kind": "bumper", "duration": 14},
               {"id": "cart-m", "title": "Records", "kind": "bumper", "duration": 41},
               {"id": "cart-l", "title": "Goat Department", "kind": "bumper", "duration": 80},
               {"id": "cart-held", "title": "Private audition", "kind": "bumper", "duration": 20}]
    return {
        "policy_version": 2, "tracks": songs + bumpers,
        "settings": {"bumper_every": 4},
        "shows": [], "chart_ids": [],
        "rotation": {
            "featured_rotation": {"multiplier": 2, "albums": ["RELEASE"], "singles": []},
            "seasonal_rotation": {"multiplier": 3, "track_ids": []},
            "bumper_brain": {"profiles": {"cart-held": {"hold": True}}}
        }
    }


class LabTests(unittest.TestCase):
    def test_determinism_and_held_tracks(self):
        catalog = fixture()
        a = simulate(catalog, days=1, seed=99)
        b = simulate(catalog, days=1, seed=99)
        self.assertEqual(a, b)
        self.assertGreater(a["song_plays"], 0)
        self.assertGreater(a["bumper_plays"], 0)
        self.assertNotIn("cart-held", [x["track_id"] for x in a["first_12_selections"]])

    def test_compare_preserves_catalog(self):
        catalog = fixture()
        before = json.dumps(catalog, sort_keys=True)
        report = compare(catalog, days=1, candidate_bumper_every=2,
                         candidate_release_multiplier=1)
        self.assertEqual(report["schema"], "humkin.radio.station-lab/v1")
        self.assertEqual(report["candidate"]["policy"]["bumper_every"], 2)
        self.assertEqual(report["baseline"]["policy"]["bumper_every"], 4)
        self.assertEqual(report["candidate"]["policy"]["featured_multiplier"], 1)
        self.assertEqual(json.dumps(catalog, sort_keys=True), before)
        self.assertNotEqual(report["baseline"]["metrics"]["bumper_plays"],
                            report["candidate"]["metrics"]["bumper_plays"])

    def test_trace_drops_secrets_and_can_inspect_browser_report(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "private.jsonl"
            log = BlackBox(path)
            self.assertTrue(log.record("source_select", {
                "mode": "stream", "track_id": "song-1", "token": "secret!",
                "url": "icecast://source:password@example.org:8000/radio"}))
            self.assertFalse(log.record("arbitrary_event", {}))
            text = path.read_text(encoding="utf-8")
            self.assertIn("song-1", text)
            self.assertNotIn("password", text)
            self.assertNotIn("secret!", text)
            browser = Path(temp) / "report.json"
            browser.write_text(json.dumps({"schema": "humkin.radio.blackbox/v1",
                "events": [{"event": "source_select", "track_id": "song-1"},
                           {"event": "stalled", "track_id": "song-1"},
                           {"event": "audio_error", "audio_code": 3}]}),
                encoding="utf-8")
            report = inspect_receiver(browser)
            self.assertEqual(report["error_or_stall_events"], 2)
            self.assertEqual(report["events_examined"], 3)

    def test_rejects_missing_catalog(self):
        c = fixture()
        c["tracks"] = []
        with self.assertRaises(ValueError):
            simulate(c, days=1)


if __name__ == "__main__":
    unittest.main()
