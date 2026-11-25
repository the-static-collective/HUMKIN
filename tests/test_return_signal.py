import datetime as dt
import sys
from pathlib import Path
import struct
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from return_signal import select_segment,measure,append,reviewed_response,SCHEMA
class TestReturnSignal(unittest.TestCase):
    def test_segment(self):
        url,when,title,ident=select_segment("#EXTM3U\n#EXT-X-PROGRAM-DATE-TIME:2026-11-01T00:00:00Z\n#EXTINF:4.0,\n"+"a"*32+"/segment-0000000001.ts\n")
        self.assertTrue(url.endswith("segment-0000000001.ts"))
        self.assertEqual(title,"")
    def test_reject_external(self):
        with self.assertRaises(ValueError):select_segment("#EXTM3U\n#EXT-X-PROGRAM-DATE-TIME:2026-11-01T00:00:00Z\n#EXTINF:4.0,\nhttps://evil.test/x.ts")
    def test_audio_and_dedup(self):
        pcm=struct.pack("<h",16384)*8000
        self.assertEqual(measure(pcm)["rms_dbfs"],-6.0)
        feed={"schema":SCHEMA,"entries":[]}
        entry={"id":"x"}
        self.assertEqual(append(append(feed,entry),entry)["entries"],[entry])
    def test_reviewed_correspondence(self):
        source={"id":"s","agent":"SIGNAL EAR","basis":"audio","media_at":"time","track_title":"Title","recording_id":"track"}
        feed={"schema":SCHEMA,"entries":[source]}
        entry=reviewed_response(feed,"s","MOTIF","creative","A visual association.")
        self.assertEqual(entry["source_sample_id"],"s")
        self.assertEqual(entry["track_title"],"Title")
        self.assertEqual(entry["basis"],"creative")
        with self.assertRaises(ValueError):reviewed_response(feed,"missing","MOTIF","creative","Hello")
        with self.assertRaises(ValueError):reviewed_response(feed,"s","MOTIF","audio","Hello")
        with self.assertRaises(ValueError):reviewed_response(feed,"s","UNKNOWN","creative","Hello")
if __name__=="__main__":unittest.main()
