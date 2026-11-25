import copy
import hashlib
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools/radio-broadcast"))
from house_rotation import make_quiet_selection, validate_selection, fingerprint
from autopilot_publisher import validate_quiet_cycle, validate_quiet_transition, clock_ms

def fixture():
    rows = []
    for n in range(60):
        uid = f"00000000-0000-0000-0000-{n:012x}"
        sha = hashlib.sha256(uid.encode()).hexdigest()
        rows.append({"id":uid,"sha256":sha,"r2_object_key":f"tracks/{uid}/{sha}.mp3",
                     "title":f"Song {n}","artist":"HUMKIN","album":"",
                     "duration_seconds":240,"kind":"song","enabled":True,
                     "published_at":"2026-11-01","storage_provider":"r2"})
    return rows

class QuietSelection(unittest.TestCase):
    def test_curated_exact_order(self):
        rows=fixture()
        ids=[x["id"] for x in reversed(rows)]
        packet=make_quiet_selection(rows,ids)
        self.assertEqual([x["id"] for x in packet["tracks"]],ids)
        self.assertEqual(validate_selection(packet,rows),"quiet-frequency")
    def test_reject_duplicates_short_unapproved_and_drift(self):
        rows=fixture()
        ids=[x["id"] for x in rows]
        for wrong in ([],ids[:-1],ids+[ids[0]],ids[:-1]+["bad"]):
            with self.assertRaises(ValueError): make_quiet_selection(rows,wrong)
        packet=make_quiet_selection(rows,ids)
        changed=copy.deepcopy(rows)
        changed[0]["enabled"]=False
        with self.assertRaises(ValueError): validate_selection(packet,changed)
        packet["tracks"].reverse()
        with self.assertRaises(ValueError): validate_selection(packet,rows)
    def test_actual_encoded_cycle(self):
        tracks=[{"asset_sha":str(n),"durations_ms":[10000]*24} for n in range(60)]
        validate_quiet_cycle(tracks)
        with self.assertRaises(ValueError): validate_quiet_cycle(tracks[:-1])
        with self.assertRaises(ValueError): validate_quiet_cycle(tracks+[tracks[0]])

    def test_cross_revision_lookback(self):
        # An intervening revision cannot hide a recent play from an older one.
        def tr(sha):
            return {"asset_sha":sha,"durations_ms":[10000]*24}
        a={"effective_at":"2026-11-01T00:00:00Z","tracks":[tr("a"),tr("b")]}
        b={"effective_at":"2026-11-01T00:04:00Z","tracks":[tr("c"),tr("d")]}
        cutover=clock_ms("2026-11-01T00:08:00Z")
        with self.assertRaises(ValueError):
            validate_quiet_transition([a,b],[tr("a")],cutover)
        validate_quiet_transition([a,b],[tr("never played")],cutover)

if __name__ == "__main__":
    unittest.main()
