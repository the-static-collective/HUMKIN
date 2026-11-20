#!/usr/bin/env python3
"""Offline acceptance for TOWER multi-select batch actions and reusable programs."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1] / "tools" / "radio-broadcast"
sys.path.insert(0, str(ROOT))
from on_air import Desk, serve
from scheduler_v2 import StationV2
from tower_library import TowerLibrary


def catalog():
    return {"policy_version": 2, "tracks": [
        {"id": f"song-{index}", "title": f"Song {index}", "artist": "HUMKIN",
         "kind": "song", "duration": 180}
        for index in range(5)], "shows": [], "settings": {}}


class BatchAndProgramsTests(unittest.TestCase):
    def make_desk(self, directory, *, tower=False):
        root = Path(directory)
        crate = TowerLibrary(root / "crate", "station-one") if tower else None
        return Desk(StationV2(catalog()), root / "programming.json", tower=crate)

    def test_policy_batch_undo_and_restart(self):
        with tempfile.TemporaryDirectory() as root:
            desk = self.make_desk(root)
            desk.act({"action": "batch", "operation": "disable",
                      "ids": ["song-0", "song-1"]})
            self.assertTrue(desk.track("song-0")["disabled"])
            self.assertTrue(desk.track("song-1")["disabled"])
            self.assertFalse(desk.track("song-2")["disabled"])
            rebuilt = self.make_desk(root)
            self.assertTrue(rebuilt.track("song-0")["disabled"])
            rebuilt.act({"action": "undo"})
            self.assertFalse(self.make_desk(root).track("song-0")["disabled"])
            self.assertFalse(self.make_desk(root).track("song-1")["disabled"])

    def test_batch_is_atomic_on_invalid_id_weight_or_dead_air(self):
        with tempfile.TemporaryDirectory() as root:
            desk = self.make_desk(root)
            with self.assertRaises(ValueError):
                desk.act({"action": "batch", "operation": "disable",
                          "ids": ["song-0", "missing"]})
            self.assertEqual(desk.state["history"], [])
            with self.assertRaises(ValueError):
                desk.act({"action": "batch", "operation": "disable",
                          "ids": [f"song-{i}" for i in range(5)]})
            self.assertFalse(any(desk.track(f"song-{i}")["disabled"] for i in range(5)))
            desk.act({"action": "batch", "operation": "less",
                      "ids": ["song-0", "song-1"]})
            desk.act({"action": "batch", "operation": "less", "ids": ["song-0"]})
            snapshot = json.dumps(desk.state, sort_keys=True)
            with self.assertRaises(ValueError):
                desk.act({"action": "batch", "operation": "less",
                          "ids": ["song-1", "song-0"]})
            self.assertEqual(json.dumps(desk.state, sort_keys=True), snapshot)
            with self.assertRaises(ValueError):
                desk.act({"action": "batch", "operation": "hold",
                          "ids": ["song-1", "song-1"]})

    def test_queue_order_and_one_transaction(self):
        with tempfile.TemporaryDirectory() as root:
            desk = self.make_desk(root)
            desk.act({"action": "batch", "operation": "queue_end",
                      "ids": ["song-2", "song-1"]})
            desk.act({"action": "batch", "operation": "queue_next",
                      "ids": ["song-4", "song-0"]})
            self.assertEqual(desk.state["lineup"],
                             ["song-4", "song-0", "song-2", "song-1"])
            desk.act({"action": "batch", "operation": "hold", "ids": ["song-1"]})
            with self.assertRaises(ValueError):
                desk.act({"action": "batch", "operation": "queue_end",
                          "ids": ["song-2", "song-1"]})
            self.assertEqual(len(desk.state["lineup"]), 4)

    def test_program_save_edit_insert_delete_and_conflict(self):
        with tempfile.TemporaryDirectory() as root:
            desk = self.make_desk(root)
            message = desk.act({"action": "program_save", "program": {
                "name": "Friday Night", "notes": "Open and close warmly",
                "track_ids": ["song-2", "song-1", "song-2"]}})
            self.assertIn("No broadcast change", message)
            self.assertEqual(desk.state["lineup"], [])
            draft = desk.view()["programs"][0]
            self.assertEqual(draft["revision"], 1)
            self.assertEqual(draft["track_ids"], ["song-2", "song-1", "song-2"])
            desk = self.make_desk(root)
            self.assertEqual(desk.view()["programs"][0]["name"], "Friday Night")
            desk.act({"action": "program_save", "program": {
                "id": draft["id"], "revision": 1,
                "name": "Friday Night Revised", "notes": "Reordered",
                "track_ids": ["song-1", "song-2"]}})
            with self.assertRaisesRegex(ValueError, "changed"):
                desk.act({"action": "program_queue", "program_id": draft["id"],
                          "revision": 1, "placement": "next"})
            self.assertEqual(desk.state["lineup"], [])
            desk.act({"action": "program_queue", "program_id": draft["id"],
                      "revision": 2, "placement": "next"})
            self.assertEqual(desk.state["lineup"], ["song-1", "song-2"])
            desk.act({"action": "program_delete", "program_id": draft["id"], "revision": 2})
            self.assertEqual(desk.view()["programs"], [])
            self.assertEqual(desk.state["lineup"], ["song-1", "song-2"])

    def test_program_invalid_and_held_insert_never_partially_queues(self):
        with tempfile.TemporaryDirectory() as root:
            desk = self.make_desk(root)
            for invalid in (
                {"name": "", "track_ids": ["song-0"]},
                {"name": "Empty", "track_ids": []},
                {"name": "Not here", "track_ids": ["missing"]},
                {"name": "Too many", "track_ids": ["song-0"] * 251}
            ):
                with self.assertRaises(ValueError):
                    desk.act({"action": "program_save", "program": invalid})
            desk.act({"action": "program_save", "program": {
                "name": "Ready", "track_ids": ["song-0", "song-1"]}})
            draft = desk.view()["programs"][0]
            desk.act({"action": "batch", "operation": "hold", "ids": ["song-1"]})
            with self.assertRaisesRegex(ValueError, "held"):
                desk.act({"action": "program_queue", "program_id": draft["id"],
                          "revision": 1, "placement": "end"})
            self.assertEqual(desk.state["lineup"], [])

    def test_batch_metadata_is_per_frequency_and_does_not_change_ids(self):
        with tempfile.TemporaryDirectory() as root:
            desk = self.make_desk(root)
            desk.act({"action": "batch", "operation": "metadata",
                      "field": "genre", "value": "Synthfolk",
                      "ids": ["song-0", "song-1"]})
            self.assertEqual(desk.track("song-0")["genre"], "Synthfolk")
            self.assertEqual(desk.track("song-1")["genre"], "Synthfolk")
            self.assertEqual(desk.track("song-2")["genre"], "")
            with self.assertRaises(ValueError):
                desk.act({"action": "batch", "operation": "metadata",
                          "field": "artwork", "value": "https://evil.invalid/x.jpg",
                          "ids": ["song-0", "song-1"]})
            self.assertEqual(desk.state["metadata"]["song-0"], {"genre": "Synthfolk"})

    def test_peer_frequency_batch_commits_once_or_refuses_all(self):
        with tempfile.TemporaryDirectory() as root:
            parent = Path(root) / "crate"
            sender = TowerLibrary(parent, "station-one")
            destination = TowerLibrary(parent, "talk")
            target = Desk(StationV2(catalog()), Path(root) / "talk.json", tower=destination)
            server, _ = serve(target, 0)
            try:
                message = sender.route_batch("talk", ["song-3", "song-1"], "queue_end")
                self.assertIn("2 recordings", message)
                self.assertEqual(target.state["lineup"], ["song-3", "song-1"])
                with self.assertRaises(ValueError):
                    sender.route_batch("talk", ["song-0", "missing"], "queue_next")
                self.assertEqual(target.state["lineup"], ["song-3", "song-1"])
            finally:
                server.unregister_desk()
                server.shutdown()
                server.server_close()

    def test_batch_curated_lineup_on_secondary_frequency(self):
        with tempfile.TemporaryDirectory() as root:
            library = TowerLibrary(Path(root) / "crate", "talk")
            desk = Desk(StationV2(catalog()), Path(root) / "talk.json", tower=library)
            desk.act({"action": "batch", "operation": "lineup_add",
                      "ids": ["song-2", "song-1"]})
            self.assertEqual(desk.state["curated_lineup"], ["song-2", "song-1"])
            desk.act({"action": "lineup_enable"})
            self.assertEqual(set(desk.station.songs), {"song-1", "song-2"})
            self.assertIn(desk.pending(1)[0][1], {"song-1", "song-2"})
            with self.assertRaises(ValueError):
                desk.act({"action": "batch", "operation": "lineup_remove",
                          "ids": ["song-2", "song-1"]})
            self.assertEqual(desk.state["curated_lineup"], ["song-2", "song-1"])


if __name__ == "__main__":
    unittest.main()
