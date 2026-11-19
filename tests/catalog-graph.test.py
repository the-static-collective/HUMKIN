"""Graph invariants: immutable source, explicit relationships, revision guards and rollback."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools/radio-broadcast"))
from catalog_graph import CatalogGraph, RevisionConflict


class GraphTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.db = Path(self.folder.name) / "catalog.sqlite3"
        self.graph = CatalogGraph(self.db)
        self.original = {"id": "upload-" + "a"*64, "title": "Unshackled", "artist": "Eno Efia",
                         "album": "Unshackled Dreams", "local_audio": "/protected/song.wav"}
        self.graph.register("recording", self.original["id"], self.original)

    def tearDown(self):
        self.folder.cleanup()

    def test_original_data_stays_immutable_even_after_edits(self):
        recording = self.original["id"]
        self.assertEqual(self.graph.revision(), 0)
        self.graph.register("recording", recording, {"id": recording, "title": "bad overwrite"})
        self.assertEqual(self.graph.get(recording)["source"], self.original)
        self.assertEqual(self.graph.edit_recording(recording, {"title": "Improved", "genre": "Soul"},
                                                   0, "operator"), 1)
        node = self.graph.get(recording)
        self.assertEqual(node["source"], self.original)
        self.assertEqual(node["metadata"]["title"], "Improved")
        self.assertEqual(node["metadata"]["genre"], "Soul")
        self.assertEqual(self.graph.undo_latest(1, "operator"), 2)
        self.assertEqual(self.graph.get(recording)["metadata"], {})
        snap = self.graph.snapshot()
        self.assertEqual(len(snap["audit"]), 2)
        self.assertEqual(snap["audit"][-1]["operation"], "undo")
        self.assertEqual(snap["nodes"][0]["source"]["local_audio"], "/protected/song.wav")

    def test_conflicting_clients_cannot_silently_overwrite(self):
        rec = self.original["id"]
        other = CatalogGraph(self.db)
        v1 = self.graph.edit_recording(rec, {"artist": "Correct credit"}, 0, "tower-one")
        self.assertEqual(v1, 1)
        with self.assertRaises(RevisionConflict):
            other.edit_recording(rec, {"artist": "outdated"}, 0, "tower-two")
        self.assertEqual(self.graph.get(rec)["metadata"]["artist"], "Correct credit")
        with self.assertRaises(RevisionConflict):
            self.graph.undo_latest(0)
        self.assertEqual(self.graph.revision(), 1)
        self.assertEqual(len(self.graph.snapshot()["audit"]), 1)

    def test_links_use_explicit_entity_ids_not_artist_name_matching(self):
        rec = self.original["id"]
        artist_a = self.graph.new_entity("artist", "Eno Efia")
        artist_b = self.graph.new_entity("artist", "Eno Efia")
        album = self.graph.new_entity("album", "Unshackled Dreams")
        self.assertNotEqual(artist_a, artist_b)
        self.assertEqual(self.graph.link(rec, "artist-credit", artist_a, 0), 1)
        self.assertEqual(self.graph.link(album, "album-track", rec, 1), 2)
        self.assertEqual(len(self.graph.snapshot()["edges"]), 2)
        with self.assertRaises(ValueError):
            self.graph.link(rec, "artist-credit", album, 2)
        self.assertEqual(self.graph.unlink(rec, "artist-credit", artist_a, 2), 3)
        self.assertEqual(self.graph.undo_latest(3), 4)
        self.assertEqual(len(self.graph.snapshot()["edges"]), 2)

    def test_invalid_and_unregistered_edits_do_not_mutate_catalog(self):
        rec = self.original["id"]
        invalid = (
            {"title": " "},
            {"title": 99},
            {"song_id": "other"},
            {"artwork": "https://not-humkin.example/cover.jpg"},
            {"notes": "x"*1100},
        )
        for patch in invalid:
            with self.assertRaises(ValueError):
                self.graph.edit_recording(rec, patch, 0)
        with self.assertRaises(ValueError):
            self.graph.edit_recording("missing", {"title": "injected"}, 0)
        with self.assertRaises(ValueError):
            self.graph.register("recording", "impostor", self.original)
        self.assertEqual(self.graph.revision(), 0)
        self.assertEqual(self.graph.get(rec)["metadata"], {})


if __name__ == "__main__":
    unittest.main()
