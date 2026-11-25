import sys
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from echo_orchard import archive
from return_signal import select_segment,CLOUD_PLAYLIST
class Orchard(unittest.TestCase):
    def test_archive_append_and_collision(self):
        with TemporaryDirectory() as d:
            seed={"id":"a"*64,"state":"proposal_only","created_at":"2026-11-24T23:59:00Z"}
            self.assertTrue(archive(d,seed))
            self.assertFalse(archive(d,seed))
            with self.assertRaises(ValueError):archive(d,dict(seed,state="published"))
            with self.assertRaises(ValueError):archive(d,dict(seed,extra="changed"))
    def test_cloud_allowlist(self):
        m="#EXTM3U\n#EXT-X-PROGRAM-DATE-TIME:2026-11-24T00:00:00Z\n#EXTINF:4.0,\n./segments/"+"a"*64+"/segment-000001.ts\n"
        self.assertTrue(select_segment(m,CLOUD_PLAYLIST)[0].endswith("segment-000001.ts"))
        with self.assertRaises(ValueError):select_segment(m)
if __name__=="__main__":unittest.main()
