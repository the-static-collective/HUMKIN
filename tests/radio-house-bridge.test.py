#!/usr/bin/env python3
"""Offline review-first hosted AzuraCast transfer tests (no third-party uploads)."""
import importlib.util
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

root=Path("tools/radio-broadcast").resolve()
sys.path.insert(0,str(root))
spec=importlib.util.spec_from_file_location("radio_media_transfer",root/"azuracast_media_bridge.py")
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)

class Tests(unittest.TestCase):
    def setUp(self):
        self.catalog={"tracks":[
          {"id":"mutant-pop-01","title":"Noontime Bloom","artist":"HUMKIN",
           "kind":"song","url":"https://humkin.abundent.org/audio/01_Noontime_Bloom.mp3","duration":165},
          {"id":"crate-123","title":"Cloud","artist":"HUMKIN","kind":"song",
           "url":"https://kbhqacsdvjsstzyplqij.supabase.co/storage/v1/object/public/humkin-radio-live/x.mp3","duration":150},
          {"id":"kinship-copy","title":"NOT OURS","artist":"Kinship",
           "url":"https://kinshipradio.org/main/stream.mp3","duration":100}
        ]}
        self.manifest=bridge.new_manifest(self.catalog)
    def test_review_manifest_excludes_third_party(self):
        self.assertEqual(len(self.manifest["tracks"]),2)
        self.assertEqual(self.manifest["version"],bridge.VERSION)
        self.assertTrue(all(t["rights"]=="needs_human_review" for t in self.manifest["tracks"]))
        with self.assertRaises(ValueError):bridge.checked_entry(self.manifest,"mutant-pop-01")
        with self.assertRaises(ValueError):bridge.checked_entry(self.manifest,"kinship-copy")
    def test_one_cleared_owned_track_is_transferrable(self):
        self.manifest["tracks"][0]["rights"]="cleared_for_internet_radio"
        self.manifest["tracks"][0]["permission_ref"]="Owner-owned-recording-2026"
        item=bridge.checked_entry(self.manifest,"mutant-pop-01")
        self.assertEqual(item["id"],"mutant-pop-01")
        item["broadcast_use"]="local_preview"
        with self.assertRaises(ValueError):bridge.checked_entry(self.manifest,"mutant-pop-01")
    def test_untrusted_origins_never_eligible(self):
        for source in ["file:///tmp/test.mp3","https://kinshipradio.org/main/music.mp3",
          "https://rockimpactmakersglobal.org/test.mp3",
          "http://humkin.abundent.org/fm/music.mp3",
          "https://us:secret@humkin.abundent.org/audio/x.mp3"]:
            self.assertFalse(bridge.source_allowed(source))
    def test_api_endpoint_single_path_safe(self):
        item=self.manifest["tracks"][0]
        captured=[]
        class Response:
            status=201
            def read(self,n):return b'{"message":"added"}'
            def __enter__(self):return self
            def __exit__(self,*args):pass
        def fake(req,timeout):
            captured.append(req)
            return Response()
        with patch.object(bridge,"download_public_mp3",return_value=b"ID3"+b"\0"*2000):
            with patch.object(bridge.urllib.request,"urlopen",side_effect=fake):
                result=bridge.upload_one(item,"https://radio.example.org", "1","test-secret")
        self.assertEqual(result["target_path"],"HUMKIN/mutant-pop-01.mp3")
        self.assertEqual(len(captured),1)
        body=json.loads(captured[0].data)
        self.assertEqual(body["path"],result["target_path"])
        self.assertTrue(len(body["file"])>2000)
        self.assertNotIn("test-secret",json.dumps(result))
if __name__=="__main__":
    unittest.main()
