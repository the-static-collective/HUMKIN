"""Exercise live Tower coordination and the public cue contract with local audio only."""
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools/radio-broadcast"))
from hls_push import Publisher
from now_playing import CueSheet
from on_air import Desk, serve
from scheduler_v2 import StationV2
from tower_library import TowerLibrary


class Bucket:
    def __init__(self):
        self.objects = {}

    def put_object(self, Key, Body, **kwargs):
        self.objects[Key] = Body


def slot(desk):
    return desk.view()["queue"][0]


class TowerTests(unittest.TestCase):
    def test_publisher_attaches_stable_cues_to_the_sliding_audio_window(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sheet = CueSheet(root, 5300)
            sheet.record(0, {"id": "one", "title": "Écho", "artwork": "https://humkin.abundent.org/cover.jpg"})
            sheet.record(18.25, {"id": "two", "title": "Second"})
            sheet.record(50.5, None)
            sheet.record(120, {"id": "future", "title": "Future queued track"})
            bucket = Bucket()
            sender = Publisher("test", root, bucket, session="a" * 32, frequency="talk")

            def write_manifest(sequence, stamp):
                manifest = ["#EXTM3U", f"#EXT-X-MEDIA-SEQUENCE:{sequence}",
                            f"#EXT-X-PROGRAM-DATE-TIME:2026-11-18T23:01:{stamp}+00:00"]
                for part in range(sequence, sequence + 3):
                    name = f"segment-{part:012}.ts"
                    (root / name).write_bytes(b"G" + b"\0" * 187)
                    manifest.extend(["#EXTINF:10.000000,", name])
                (root / "index.m3u8").write_text("\n".join(manifest) + "\n")
                self.assertTrue(sender.publish_once())
                public = bucket.objects["live/talk/live.m3u8"].decode()
                lines = re.findall(r'START-DATE="([^"]+)",X-HUMKIN="([^"]+)"', public)
                return [(stamp, json.loads(base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))))
                        for stamp, data in lines]

            first = write_manifest(5300, "00.000")
            self.assertEqual(first[0][1]["title"], "Écho")
            self.assertEqual(first[0][1]["artwork"], "https://humkin.abundent.org/cover.jpg")
            self.assertTrue(first[1][0].endswith("18.250+00:00"))
            self.assertEqual(write_manifest(5302, "20.010"), first[1:])
            third = write_manifest(5303, "30.010")
            self.assertEqual(third[0], first[1])
            self.assertIsNone(third[1][1])
            self.assertNotIn("live/station-one/live.m3u8", bucket.objects)

    @unittest.skipUnless(shutil.which("ffprobe") and shutil.which("ffmpeg"), "FFmpeg required")
    def test_upload_reorder_persistence_and_peer_queue(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            main_library = TowerLibrary(root, "station-one")
            side_library = TowerLibrary(root, "talk")
            base = {"tracks": [{"id": name, "title": name.upper(), "artist": "Fixture",
                                "duration": 7, "kind": "song"} for name in ("a", "b", "c")]}
            main = Desk(StationV2(base), root / "main.json", tower=main_library)
            side = Desk(StationV2(base), root / "side.json", tower=side_library)
            server, origin = serve(main, 0)
            peer, _ = serve(side, 0)
            try:
                with urlopen(origin, timeout=2) as response:
                    page = response.read().decode()
                token = re.search(r'name="station-control" content="([^"]+)"', page)[1]
                file = root / "synthetic.mp3"
                subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440",
                                "-t", "1", "-metadata", "title=TAGGED", str(file)], check=True, timeout=15)
                bytes_ = file.read_bytes()
                headers = {"Origin": origin, "X-Station-Control": token,
                           "X-Upload-Name": "fallback%20name.mp3"}
                with self.assertRaises(HTTPError) as exc:
                    urlopen(Request(origin + "/upload", bytes_, headers | {"Origin": "https://example.invalid"}))
                with exc.exception:
                    self.assertEqual(exc.exception.code, 403)
                with urlopen(Request(origin + "/upload", bytes_, headers), timeout=45) as response:
                    self.assertIn("TAGGED", json.load(response)["message"])
                self.assertEqual(slot(main)["title"], "TAGGED")
                self.assertNotEqual(slot(side)["title"], "TAGGED")
                item = "upload-" + hashlib.sha256(bytes_).hexdigest()
                self.assertEqual(main_library.route("talk", item), "Queued on talk.")
                self.assertEqual(slot(side)["id"], item)
                self.assertEqual({x["id"] for x in main_library.frequencies()}, {"station-one", "talk"})
                main.act({"action": "queue_next", "id": "b"})
                first, second, *_ = main.view()["queue"]
                main.act({"action": "reorder", "slot": first["slot"], "target": second["slot"]})
                self.assertEqual(slot(main)["id"], item)
                with self.assertRaises(ValueError):
                    main.act({"action": "reorder", "slot": first["slot"], "target": second["slot"]})
                main.act({"action": "rotation_upload", "id": item})
                rebuilt = Desk(StationV2(base), root / "main.json", tower=main_library)
                self.assertEqual(slot(rebuilt)["id"], item)
                self.assertIn(item, rebuilt.station.songs)
                self.assertTrue(main.start(main.pending(1)[0]))
                self.assertEqual(slot(main)["id"], "b")
                self.assertEqual(slot(side)["id"], item)
            finally:
                for listener in (server, peer):
                    listener.shutdown()
                    listener.server_close()
                    listener.unregister_desk()


if __name__ == "__main__":
    unittest.main()

