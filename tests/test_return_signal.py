import datetime as dt
import sys
from pathlib import Path
import struct
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from return_signal import select_segment,measure,append,SCHEMA
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
if __name__=="__main__":unittest.main()
