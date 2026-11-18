"""Regression guards: seasonal uploads are fingerprinted, not title-matched."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "tools" / "radio-broadcast"))
from scheduler_v2 import featured_extra

HASH_1 = "ffc6cc64c5233b4d3ec35cdb2c935c65e3bf37d8e60767bf455b63809820c2b5"
HASH_2 = "a9223523d009c520a7add920b954258c73017198eb0411bfa6a54e795f1136a4"
HASH_3 = "e9b16482a25cce61b9bc6a68aa5589cb9a36ef28007b5c3436b73d8458b8a964"


class GuestSeasonals(unittest.TestCase):
    def setUp(self):
        self.tracks = {
            "crate-a": {"id": "crate-a", "album": "Unshackled Dreams", "source": "cloud", "sha256": HASH_1},
            "crate-b": {"id": "crate-b", "album": "Unshackled Dreams", "source": "cloud", "sha256": HASH_2},
            "crate-c": {"id": "crate-c", "album": "Unshackled Dreams", "source": "cloud", "sha256": HASH_3},
            "crate-other": {"id": "crate-other", "album": "Unshackled Dreams", "source": "cloud", "sha256": "0"*64}
        }
        self.song_ids = list(self.tracks)
        self.seasonal = {"multiplier": 3, "sha256s": [HASH_1, HASH_2, HASH_3]}

    def test_feature_songs_get_three_total_plays(self):
        rotation = {"featured_rotation": {"multiplier": 2, "albums": [], "singles": []},
                    "seasonal_rotation": self.seasonal}
        extras = featured_extra(self.song_ids, self.tracks, rotation)
        self.assertEqual(extras.count("crate-a"), 2)
        self.assertEqual(extras.count("crate-b"), 2)
        self.assertEqual(extras.count("crate-c"), 2)
        self.assertNotIn("crate-other", extras)

    def test_featured_plus_seasonal_still_three_total_not_five(self):
        rotation = {"featured_rotation": {"multiplier": 2, "albums": ["Unshackled Dreams"], "singles": []},
                    "seasonal_rotation": self.seasonal}
        extras = featured_extra(self.song_ids, self.tracks, rotation)
        for ident in ("crate-a", "crate-b", "crate-c"):
            self.assertEqual(extras.count(ident), 2)

    def test_unpublished_songs_cannot_appear_without_catalog_entry(self):
        tracks = {"crate-other": self.tracks["crate-other"]}
        extras = featured_extra(["crate-other"], tracks, {"seasonal_rotation": self.seasonal})
        self.assertEqual(extras, [])

    def test_wrong_hash_is_not_a_seasonal(self):
        self.tracks["crate-a"]["sha256"] = "f"*64
        extras = featured_extra(self.song_ids, self.tracks, {"seasonal_rotation": self.seasonal})
        self.assertNotIn("crate-a", extras)


if __name__ == "__main__":
    unittest.main()
