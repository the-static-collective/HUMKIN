#!/usr/bin/env python3
"""Offline acceptance: one encoder, hot+delayed playlists, freshness and sleep guard."""
import importlib.util
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

MODULES = Path(__file__).resolve().parents[1] / "tools" / "radio-broadcast"
sys.path.insert(0, str(MODULES))
from hls_reservoir import air_windows, parse_hls_history, IncompleteHistory
from keep_awake import keep_awake_during_broadcast, ES_CONTINUOUS, ES_SYSTEM_REQUIRED

spec = importlib.util.spec_from_file_location("hls_push", MODULES / "hls_push.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

SESSION = "0123456789abcdef0123456789abcdef"
START = 1763000000


def history(count, first=START, duration=10):
    first_time = datetime(2026, 11, 19, 10, 0, tzinfo=timezone.utc)
    lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:10",
             "#EXT-X-MEDIA-SEQUENCE:" + str(first)]
    for i in range(count):
        lines.extend(["#EXT-X-PROGRAM-DATE-TIME:" +
                      (first_time + timedelta(seconds=i * duration)).isoformat(),
                      "#EXTINF:%.3f," % duration,
                      "segment-%012d.ts" % (first + i)])
    return "\n".join(lines) + "\n"


class FakeS3:
    def __init__(self):
        self.calls = []
        self.objects = {}
    def put_object(self, **kwargs):
        self.calls.append(("put", kwargs["Key"]))
        self.objects[kwargs["Key"]] = kwargs["Body"]
    def delete_object(self, **kwargs):
        self.calls.append(("delete", kwargs["Key"]))
        self.objects.pop(kwargs["Key"], None)


class ReservoirTest(unittest.TestCase):
    def test_two_broadcast_clocks_share_original_encoded_segments(self):
        hot, delayed, names = air_windows(history(72), SESSION, 480)
        self.assertEqual(len(names), 72)
        self.assertIn(b"#EXT-X-MEDIA-SEQUENCE:1763000060", hot)
        self.assertIn(b"#EXT-X-MEDIA-SEQUENCE:1763000012", delayed)
        self.assertIn((SESSION + "/segment-001763000071.ts").encode(), hot)
        self.assertIn((SESSION + "/segment-001763000023.ts").encode(), delayed)
        self.assertNotIn(b"#EXT-X-ENDLIST", hot)
        self.assertEqual(hot.count(b"#EXTINF:"), 12)
        self.assertEqual(delayed.count(b"#EXTINF:"), 12)

    def test_delay_is_strict_and_missing_history_does_not_pretend_to_be_live(self):
        hot, delayed, _ = air_windows(history(40), SESSION, 480)
        self.assertIsNone(delayed)
        self.assertEqual(hot.count(b"#EXTINF:"), 12)
        _, almost, _ = air_windows(history(50), SESSION, 480)
        self.assertIsNone(almost)
        _, ready, _ = air_windows(history(51), SESSION, 480)
        self.assertIsNotNone(ready)
        with self.assertRaises(IncompleteHistory):
            air_windows(history(2), SESSION, 480)

    def test_source_rejects_reordered_gapped_and_untrusted_hls(self):
        good = history(60)
        bad = [
            good.replace("segment-001763000005.ts", "segment-001763000006.ts"),
            good.replace("segment-001763000005.ts", "../escape.ts"),
            good.replace("#EXT-X-VERSION:3", "#EXT-X-KEY:METHOD=AES-128"),
            good.replace("#EXTINF:10.000", "#EXTINF:1000.000", 1),
            good.replace("#EXT-X-PROGRAM-DATE-TIME:", "#EXT-X-NOT-A-TIME:", 1),
            good + "#EXT-X-ENDLIST\n",
        ]
        for item in bad:
            with self.subTest(sample=item[-100:]), self.assertRaises(ValueError):
                parse_hls_history(item)

    def test_publish_segments_before_both_manifests_and_do_not_duplicate_encoding(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for n in range(START, START + 54):
                (root / ("segment-%012d.ts" % n)).write_bytes(b"\x47" + b"x" * 187)
            (root / "index.m3u8").write_text(history(54), encoding="utf-8")
            client = FakeS3()
            publisher = bridge.Publisher("humkin-radio-live", root, client,
                                         session=SESSION, reservoir_seconds=480)
            self.assertTrue(publisher.publish_once())
            hot_key = "live/station-one/live.m3u8"
            delay_key = "live/station-one/delayed.m3u8"
            self.assertEqual(client.calls[-2:], [("put", hot_key), ("put", delay_key)])
            self.assertEqual(len([k for verb,k in client.calls if verb == "put" and
                                  k.endswith(".ts")]), 54)
            self.assertIn(SESSION.encode() + b"/segment-", client.objects[hot_key])
            self.assertIn(SESSION.encode() + b"/segment-", client.objects[delay_key])
            self.assertTrue(publisher.publish_once())
            self.assertEqual(len(client.calls), 56, "No wasted R2 writes or second encoder")

    def test_does_not_upload_delayed_manifest_until_safe_delay_exists(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for n in range(START, START + 40):
                (root / ("segment-%012d.ts" % n)).write_bytes(b"\x47" + b"x" * 187)
            (root / "index.m3u8").write_text(history(40), encoding="utf-8")
            client = FakeS3()
            publisher = bridge.Publisher("humkin-radio-live", root, client,
                                         session=SESSION, reservoir_seconds=480)
            self.assertTrue(publisher.publish_once())
            self.assertIn("live/station-one/live.m3u8", client.objects)
            self.assertNotIn("live/station-one/delayed.m3u8", client.objects)

    def test_encoder_retains_more_segments_only_when_requested(self):
        import engine
        with patch.object(engine.subprocess, "Popen") as spawn:
            engine.output_process("", 96, hls_dir="fake", hls_history_segments=96)
            args = spawn.call_args.args[0]
            self.assertEqual(args[args.index("-hls_list_size") + 1], "96")
            self.assertEqual(args.count("-f"), 2)
        with patch.object(engine.subprocess, "Popen") as spawn:
            engine.output_process("", 96, hls_dir="fake")
            args = spawn.call_args.args[0]
            self.assertEqual(args[args.index("-hls_list_size") + 1], "12")


class SleepTest(unittest.TestCase):
    def test_system_only_assertion_stays_active_for_broadcast_and_is_released(self):
        calls = []
        def set_state(flags):
            calls.append(flags)
            return 1
        with keep_awake_during_broadcast(platform="win32", set_state=set_state) as active:
            self.assertTrue(active)
            self.assertEqual(calls, [ES_CONTINUOUS | ES_SYSTEM_REQUIRED])
        self.assertEqual(calls, [ES_CONTINUOUS | ES_SYSTEM_REQUIRED, ES_CONTINUOUS])

    def test_exit_exception_still_releases_guard(self):
        calls = []
        with self.assertRaisesRegex(RuntimeError, "stop"):
            with keep_awake_during_broadcast(
                    platform="win32", set_state=lambda flags: calls.append(flags) or 1):
                raise RuntimeError("stop")
        self.assertEqual(calls[-1], ES_CONTINUOUS)

    def test_power_api_failure_does_not_kill_music(self):
        alerts = []
        with keep_awake_during_broadcast(
                platform="win32", set_state=lambda _: 0, warn=alerts.append) as active:
            self.assertFalse(active)
        self.assertEqual(len(alerts), 1)

    def test_other_systems_are_unmodified(self):
        calls = []
        with keep_awake_during_broadcast(
                platform="linux", set_state=lambda x: calls.append(x) or 1) as active:
            self.assertFalse(active)
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
