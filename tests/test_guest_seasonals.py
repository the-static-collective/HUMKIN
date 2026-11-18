"""HUMKIN guest feature: two seasonal songs, interview is not music rotation."""
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "radio-broadcast"))
from scheduler_v2 import featured_extra

FEATURE = next(f for f in json.loads((ROOT / "fm" / "guest-features.json").read_text())["features"]
               if f["id"] == "eno-efia-unshackled-dreams")
SEASONAL = json.loads((ROOT / "fm" / "rotation.json").read_text())["seasonal_rotation"]


class GuestSeasonals(unittest.TestCase):
    def setUp(self):
        self.tracks = {
            f"crate-{i}": {"id": f"crate-{i}", "album": "Unshackled Dreams",
                           "source": "cloud", "kind": row["catalog_kind"], "sha256": row["sha256"]}
            for i, row in enumerate(FEATURE["tracks"])
        }
        self.tracks["other"] = {"id": "other", "album": "Unshackled Dreams",
                                "source": "cloud", "kind": "song", "sha256": "0"*64}
        self.song_ids = [id_ for id_, t in self.tracks.items() if t["kind"]=="song"]

    def test_roles_and_feature_order(self):
        self.assertEqual([t["kind"] for t in FEATURE["tracks"]], ["song", "interview", "song"])
        self.assertEqual(FEATURE["tracks"][1]["introduces"], FEATURE["tracks"][2]["title"])
        self.assertTrue(FEATURE["tracks"][1]["feature_only"])

    def test_only_two_songs_are_seasonal(self):
        hashes = {row["sha256"] for row in FEATURE["tracks"] if row["kind"]=="song"}
        self.assertEqual(len(hashes), 2)
        self.assertEqual(set(SEASONAL["sha256s"]), hashes)
        self.assertNotIn(FEATURE["tracks"][1]["sha256"], SEASONAL["sha256s"])

    def test_music_extras(self):
        extras = featured_extra(self.song_ids, self.tracks, {"seasonal_rotation": SEASONAL})
        self.assertEqual(extras.count("crate-0"), 2)
        self.assertEqual(extras.count("crate-2"), 2)
        self.assertNotIn("crate-1", extras)
        self.assertNotIn("other", extras)

    def test_featured_and_seasonal_total_three(self):
        r = {"featured_rotation": {"multiplier": 2, "albums": ["Unshackled Dreams"]},
             "seasonal_rotation": SEASONAL}
        extras = featured_extra(self.song_ids, self.tracks, r)
        self.assertEqual(extras.count("crate-0"), 2)
        self.assertEqual(extras.count("crate-2"), 2)

    def test_interview_wrongly_tagged_song_still_has_no_seasonal_bonus(self):
        tracks = dict(self.tracks)
        tracks["crate-1"] = dict(tracks["crate-1"], kind="song")
        extras = featured_extra(list(tracks), tracks, {"seasonal_rotation": SEASONAL})
        self.assertNotIn("crate-1", extras)


if __name__ == "__main__":
    unittest.main()
