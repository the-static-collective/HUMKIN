#!/usr/bin/env python3
"""Offline HLS publisher tests: no R2 keys, network, account or live station."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "tools" / "radio-broadcast" / "hls_push.py"
spec = importlib.util.spec_from_file_location("hls_push", SOURCE)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
SESSION = "0123456789abcdef0123456789abcdef"


class FakeS3:
    def __init__(self):
        self.calls = []
        self.objects = {}

    def put_object(self, **kw):
        self.calls.append(("put", kw["Key"]))
        self.objects[kw["Key"]] = kw["Body"]

    def delete_object(self, **kw):
        self.calls.append(("delete", kw["Key"]))
        self.objects.pop(kw["Key"], None)


def playlist(start, count=4):
    lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:10",
             "#EXT-X-MEDIA-SEQUENCE:" + str(start)]
    for n in range(start, start + count):
        lines.extend(["#EXTINF:10.000,", "segment-%012d.ts" % n])
    return "\n".join(lines) + "\n"


class HlsPublisherTest(unittest.TestCase):
    def test_safe_playlist_rejects_unsafe_paths_and_keys(self):
        for bad in ["", "#EXTM3U\n../secret.ts\n",
                    "#EXTM3U\nhttps://evil.example/x.ts\n",
                    "#EXTM3U\n#EXT-X-KEY:METHOD=AES-128\n",
                    "#EXTM3U\nsegment-000000000001.ts\n",
                    "#EXTM3U\nsegment-000000000001.ts\n" * 45]:
            with self.subTest(bad=bad[:70]), self.assertRaises(ValueError):
                bridge.parse_playlist(bad)
        remote, names = bridge.rewrite_playlist(playlist(1700000000), SESSION)
        self.assertIn((SESSION + "/segment-001700000000.ts").encode(), remote)
        self.assertEqual(len(names), 4)

    def test_upload_segments_before_manifest_and_do_not_reupload(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary)
            for n in range(1700000000, 1700000004):
                (path / ("segment-%012d.ts" % n)).write_bytes(b"\x47" + b"x" * 187)
            (path / "index.m3u8").write_text(playlist(1700000000), encoding="utf-8")
            client = FakeS3()
            bridge_instance = bridge.Publisher("humkin-radio-live", path, client, session=SESSION)
            self.assertTrue(bridge_instance.publish_once())
            self.assertEqual(len(client.calls), 5)
            self.assertEqual(client.calls[-1], ("put", bridge.PLAYLIST_KEY))
            self.assertTrue(client.objects[bridge.PLAYLIST_KEY].startswith(b"#EXTM3U"))
            self.assertTrue(bridge_instance.publish_once())
            self.assertEqual(len(client.calls), 5)

    def test_missing_segment_does_not_publish_playlist(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary)
            (path / "index.m3u8").write_text(playlist(1700000000), encoding="utf-8")
            client = FakeS3()
            publisher = bridge.Publisher("humkin-radio-live", path, client, session=SESSION)
            self.assertFalse(publisher.publish_once())
            self.assertNotIn(bridge.PLAYLIST_KEY, client.objects)

    def test_unreferenced_segments_are_removed_after_grace_period(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary)
            client = FakeS3()
            current = [0.0]
            publisher = bridge.Publisher("humkin-radio-live", path, client,
                                         session=SESSION, now=lambda: current[0])
            for n in range(1700000000, 1700000006):
                (path / ("segment-%012d.ts" % n)).write_bytes(b"\x47" + b"x" * 187)
            (path / "index.m3u8").write_text(playlist(1700000000), encoding="utf-8")
            publisher.publish_once()
            current[0] = 10.0
            (path / "index.m3u8").write_text(playlist(1700000002), encoding="utf-8")
            publisher.publish_once()
            self.assertEqual(len(publisher.retired), 2)
            current[0] = 191.0
            publisher.publish_once()
            self.assertEqual(len(publisher.retired), 0)
            self.assertEqual(len([x for x in client.calls if x[0] == "delete"]), 2)


if __name__ == "__main__":
    unittest.main()
