import importlib.util
import json
import os
import pathlib
import tempfile
import unittest
from unittest import mock

SCANNER=pathlib.Path(__file__).resolve().parents[1]/"tools"/"mesh"/"scan.py"
spec=importlib.util.spec_from_file_location("humkin_mesh_scanner", SCANNER)
scanner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)


class TestMeshInventory(unittest.TestCase):
    def test_streaming_hash_and_duplicate_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=pathlib.Path(tmp)
            root=base/"Music"
            (root/"Eno Efia"/"Unshackled Dreams").mkdir(parents=True)
            (root/"Other"/"Misc").mkdir(parents=True)
            (root/"Eno Efia"/"Unshackled Dreams"/"01-Rose.mp3").write_bytes(b"sound A")
            (root/"Other"/"Misc"/"duplicate.mp3").write_bytes(b"sound A")
            (root/"Other"/"Misc"/"stems.wav").write_bytes(b"sound B")
            (root/"Other"/"Misc"/"notes.txt").write_text("private",encoding="utf-8")
            with mock.patch.dict(os.environ,{"APPDATA":str(base/"AppData")}):
                one=scanner.scan(root,"artist/album",label="Acer")
                two=scanner.scan(root,"artist/album",label="Acer")
            self.assertEqual(one["node_id"],two["node_id"])
            self.assertEqual(one["summary"]["files"],3)
            self.assertEqual(one["summary"]["unique_hashes"],2)
            self.assertEqual(one["summary"]["copies_of_existing_hashes"],1)
            self.assertEqual(one["summary"]["duplicate_bytes"],len(b"sound A"))
            self.assertEqual(one["summary"]["logical_bytes"],len(b"sound A")*2+len(b"sound B"))
            track=next(x for x in one["files"] if x["relative_path"].endswith("Rose.mp3"))
            self.assertEqual((track["artist"],track["album"],track["title"]),
                             ("Eno Efia","Unshackled Dreams","Rose"))
            self.assertTrue(all(len(x["sha256"])==64 for x in one["files"]))
            self.assertFalse(any(x["relative_path"].startswith(str(base)) for x in one["files"]))
            self.assertNotIn("private",json.dumps(one))

    def test_layout_and_atomic_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)/"Library"
            (root/"Album One"/"Artist One").mkdir(parents=True)
            (root/"Album One"/"Artist One"/"track.flac").write_bytes(b"FLAC")
            with mock.patch.dict(os.environ,{"APPDATA":str(pathlib.Path(tmp)/"settings")}):
                data=scanner.scan(root, "album/artist")
            self.assertEqual(data["files"][0]["artist"],"Artist One")
            self.assertEqual(data["files"][0]["album"],"Album One")
            self.assertEqual(data["files"][0]["extension"],"flac")
            out=pathlib.Path(tmp)/"manifest.json"
            scanner.write_atomic(out,data)
            self.assertEqual(json.loads(out.read_text())["node_id"],data["node_id"])
            self.assertEqual(list(pathlib.Path(tmp).glob(".humkin-mesh-*")),[])

    def test_invalid_layout_and_corrupt_identity_are_not_silently_reset(self):
        self.assertRaises(ValueError,scanner.layout_fields,"artist/hacker")
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.dict(os.environ,{"APPDATA":tmp}):
                identity=scanner.identity_file()
                identity.parent.mkdir(parents=True,exist_ok=True)
                identity.write_text('{"node_id":"wrong"}',encoding="utf-8")
                self.assertRaises(ValueError,scanner.get_or_create_node)


if __name__=="__main__":
    unittest.main()
