import unittest
from hashlib import sha256
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"/"radio-broadcast"))
from house_rotation import fingerprint
from tower_rolling_window import plan_window


class RollingWindowTest(unittest.TestCase):
    def setUp(self):
        rows=[{
            "id":f"10000000-0000-4000-8000-{i:012d}",
            "sha256":sha256(str(i).encode()).hexdigest(),
            "kind":"song","duration_seconds":180.0,"title":f"Song {i}"
        } for i in range(200)]
        self.full={"schema":"humkin.cloud-house-selection/v1",
                   "state":"draft_for_owner_review",
                   "mode":"full_catalog","station_id":"station-one",
                   "tracks":rows}
        self.full["fingerprint"]=fingerprint(self.full)

    def test_consecutive_windows_share_no_skipped_or_repeated_positions(self):
        first=plan_window(self.full,hours=2)
        second=plan_window(self.full,previous=first,hours=2)
        third=plan_window(self.full,previous=second,hours=2)
        self.assertEqual(first["start_cursor"],0)
        self.assertEqual(second["start_cursor"],first["next_cursor"])
        self.assertEqual(third["start_cursor"],second["next_cursor"])
        self.assertGreaterEqual(first["duration_seconds"],7200)
        self.assertLess(first["duration_seconds"],7200+180)
        sequence=first["entries"]+second["entries"]+third["entries"]
        self.assertEqual(sequence,self.full["tracks"][:len(sequence)])
        self.assertEqual(first["state"],"preview_only_requires_continuity_engine")

    def test_source_policy_changes_require_new_human_review(self):
        first=plan_window(self.full,hours=1)
        changed={**self.full,"tracks":[dict(r) for r in self.full["tracks"]]}
        changed["tracks"][0]["title"]="New title"
        changed["fingerprint"]=fingerprint(changed)
        with self.assertRaisesRegex(ValueError,"source policy"):
            plan_window(changed,previous=first,hours=1)
        with self.assertRaisesRegex(ValueError,"fingerprint changed"):
            plan_window({**self.full,"fingerprint":"b"*64})

    def test_broken_sources_and_bad_horizon_fail_closed(self):
        with self.assertRaisesRegex(ValueError,"horizon"):
            plan_window(self.full,hours=10)
        with self.assertRaisesRegex(ValueError,"unauthorized"):
            plan_window({**self.full,"state":"broadcasting"})
        with self.assertRaisesRegex(ValueError,"invalid source duration"):
            broken={**self.full,"tracks":[dict(r) for r in self.full["tracks"]]}
            broken["tracks"][10]["duration_seconds"]=float("nan")
            broken["fingerprint"]=fingerprint(broken)
            plan_window(broken,hours=2)

if __name__=="__main__":
    unittest.main()
