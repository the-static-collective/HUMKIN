import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools/radio-broadcast"))
from quiet_chapters import validate_chapters,recording_events
from autopilot_publisher import validate_quiet_cycle,validate_quiet_transition,clock_ms

def chapter(n, start=0):
    return {"start_ms":start,"recording_id":"rec-"+str(n)*64,"title":"Song "+str(n),"artist":"HUMKIN"}

class Chapters(unittest.TestCase):
    def test_offsets(self):
        for invalid in ([chapter(1,1)],[chapter(1),chapter(2,0)],[chapter(1),chapter(2,1200000)]):
            with self.assertRaises(ValueError):validate_chapters(invalid,1200000)
        self.assertEqual(validate_chapters([chapter(1),chapter(2,183500)],1200000)[1]["start_ms"],183500)
    def test_repeat_inside_different_assets(self):
        tracks=[{"asset_sha":str(n),"durations_ms":[10000]*120,"chapters":[{"start_ms":0,"recording_id":"rec-"+format(n,"064x"),"title":"Song","artist":"HUMKIN"}]} for n in range(12)]
        validate_quiet_cycle(tracks)
        tracks[1]["chapters"]=tracks[0]["chapters"]
        with self.assertRaises(ValueError):validate_quiet_cycle(tracks)
    def test_chapter_cross_revision(self):
        old={"asset_sha":"a","durations_ms":[10000]*120,"chapters":[chapter(1),chapter(2,183500)]}
        new={"asset_sha":"b","durations_ms":[10000]*120,"chapters":[chapter(2)]}
        revisions=[{"effective_at":"2026-11-01T00:00:00Z","tracks":[old]}]
        with self.assertRaises(ValueError):validate_quiet_transition(revisions,[new],clock_ms("2026-11-01T00:20:00Z"))
if __name__=="__main__":unittest.main()
