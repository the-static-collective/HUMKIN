import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from listening_council import council,relation
from unittest.mock import patch
SOURCE={"id":"a"*64,"agent":"SIGNAL EAR","basis":"audio","station_id":"station-one","observed_at":"2026-11-01T00:00:00Z","media_at":"2026-11-01T00:00:00Z","track_title":"Test","recording_id":"recording"}
class Council(unittest.TestCase):
    def test_relation_requires_exact_recording(self):
        self.assertIsNone(relation(SOURCE,{"entries":[]}))
        other=dict(SOURCE,id="b"*64)
        self.assertEqual(relation(SOURCE,{"entries":[other]})["related_sample_id"],other["id"])
        self.assertIsNone(relation(SOURCE,{"entries":[dict(other,recording_id="different")]}))
    def test_no_invented_reply(self):
        with patch("listening_council.field_answer",side_effect=ValueError("failed")):
            self.assertEqual(council(SOURCE,b"",{"entries":[]}),[])
        self.assertEqual(council(dict(SOURCE,basis="creative"),b"",{"entries":[]}),[])
if __name__=="__main__":unittest.main()
