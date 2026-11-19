#!/usr/bin/env python3
"""Offline acceptance: local dashboard requests drive real Station One MP3 playout."""
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

MODULES = Path(__file__).resolve().parents[1] / "tools" / "radio-broadcast"
sys.path.insert(0, str(MODULES))
from on_air import Desk
from scheduler_v2 import StationV2


def fixture():
    tracks = [{"id": f"track-{n}", "title": f"Tone {n}", "artist": "HUMKIN",
               "kind": "song", "duration": 9, "url": f"https://media.abundent.org/test/{n}.mp3"}
              for n in range(8)]
    return {"policy_version": 2, "tracks": tracks, "shows": [], "settings": {}}


class DeskTests(unittest.TestCase):
    def test_policy_rotation_and_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder) / "programming.json"
            catalog = fixture()
            station = StationV2(catalog)
            desk = Desk(station, state)
            desk.act({"action": "less", "id": "track-0"})
            desk.act({"action": "more", "id": "track-1"})
            desk.act({"action": "disable", "id": "track-2"})
            desk.act({"action": "hold", "id": "track-3"})
            station = StationV2(catalog)
            desk = Desk(station, state)
            counts = Counter()
            for _ in range(4):
                station.queue.clear()
                station._new_cycle()
                counts.update(station.queue)
            self.assertEqual([counts[f"track-{i}"] for i in range(5)], [2, 8, 0, 0, 4])
            self.assertTrue(desk.track("track-3")["held"])
            desk.act({"action": "undo"})
            self.assertFalse(Desk(StationV2(catalog), state).track("track-3")["held"])

    def test_show_order_and_move_undo_after_advance(self):
        with tempfile.TemporaryDirectory() as folder:
            catalog = fixture()
            desk = Desk(StationV2(catalog), Path(folder) / "programming.json")
            queue = desk.view()["queue"]
            desk.act({"action": "move", "slot": queue[0]["slot"]})
            self.assertTrue(desk.start(desk.pending(1)[0]))
            desk.act({"action": "undo"})
            self.assertEqual(desk.pending(1)[0][1], queue[0]["id"])
            catalog["shows"] = [{
                "id": "show", "is_active": True, "days": list(range(7)),
                "start_minute": 0, "end_minute": 1440,
                "track_ids": ["track-0", "track-1", "track-2"],
            }]
            self.assertTrue(desk.start(desk.pending(1)[0]))
            desk.act({"action": "hold", "id": "track-0"})
            self.assertEqual([item["id"] for item in desk.view()["queue"]], ["track-1", "track-2"])
            with self.assertRaises(ValueError):
                desk.act({"action": "move", "slot": desk.view()["queue"][0]["slot"]})

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg required")
    def test_http_controls_drive_the_encoder(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            cache = root / "cache"
            cache.mkdir()
            catalog = fixture()
            for n, track in enumerate(catalog["tracks"]):
                path = cache / (hashlib.sha256(track["url"].encode()).hexdigest() + ".mp3")
                subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i",
                                f"sine=frequency={240 + 80*n}:sample_rate=44100",
                                "-t", str(track["duration"]), "-y", str(path)], check=True)
            source = root / "catalog.json"
            source.write_text(json.dumps(catalog), encoding="utf-8")
            journal = root / "journal.jsonl"
            output = root / "output.mp3"
            log = root / "output.log"
            with log.open("wb") as stream:
                child = subprocess.Popen([
                    sys.executable, "-B", str(MODULES / "engine.py"), "--fixture", str(source),
                    "--cache", str(cache), "--file-output", str(output), "--seconds", "11",
                    "--on-air-state", str(root / "programming.json"), "--seed", "17",
                    "--black-box-file", str(journal), "--crossfade", ".25",
                ], stdout=stream, stderr=subprocess.STDOUT)
                try:
                    def wait_for(check):
                        for _ in range(100):
                            result = check()
                            if result:
                                return result
                            self.assertIsNone(child.poll(), log.read_text(errors="replace"))
                            time.sleep(.05)
                        self.fail("Timed out waiting for the local desk")

                    match = wait_for(lambda: re.search(r"http://127\.0\.0\.1:\d+", log.read_text(errors="replace")))
                    origin = match.group()
                    with urllib.request.urlopen(origin) as response:
                        html = response.read().decode("utf-8")
                    self.assertIn("Now playing", html)
                    token = re.search(r'name="station-control" content="([^"]+)"', html)[1]

                    def request(data=None, *, status=200, from_origin=origin):
                        url = origin + ("/action" if data else "/state")
                        headers = {"X-Station-Control": token, "Origin": from_origin}
                        body = json.dumps(data).encode() if data else None
                        req = urllib.request.Request(url, data=body, headers=headers)
                        try:
                            with urllib.request.urlopen(req, timeout=2) as response:
                                self.assertEqual(response.status, status)
                                return json.load(response)
                        except urllib.error.HTTPError as exc:
                            with exc:
                                self.assertEqual(exc.code, status)
                                if status != 403:
                                    return json.load(exc)

                    def ready():
                        state = request()
                        return state if state["can_skip"] else None

                    state = wait_for(ready)
                    first, second = state["queue"][:2]
                    current, play = state["current"]["id"], state["play"]
                    request({"action": "skip", "play": play}, status=403, from_origin="https://example.invalid")
                    state = request({"action": "disable", "id": current})["state"]
                    self.assertEqual(state["play"], play)
                    self.assertTrue(state["current"]["disabled"])
                    state = request({"action": "hold", "id": first["id"]})["state"]
                    self.assertEqual(state["queue"][0]["id"], second["id"])
                    self.assertEqual(state["play"], play)
                    state = request({"action": "undo"})["state"]
                    self.assertEqual(state["queue"][0]["id"], first["id"])
                    request({"action": "move", "slot": first["slot"]}, status=409)
                    state = request({"action": "move", "slot": state["queue"][0]["slot"]})["state"]
                    self.assertEqual(state["queue"][0]["id"], second["id"])
                    self.assertEqual(state["play"], play)
                    wait_for(ready)
                    request({"action": "skip", "play": play})
                    def advanced():
                        state = request()
                        return state if state["play"] != play else None
                    state = wait_for(advanced)
                    self.assertEqual(state["current"]["id"], second["id"])
                    request({"action": "skip", "play": play}, status=409)
                    self.assertEqual(child.wait(timeout=20), 0, log.read_text(errors="replace"))
                finally:
                    if child.poll() is None:
                        child.kill()
                        child.wait()

            events = [json.loads(line) for line in journal.read_text().splitlines()]
            skips = [event for event in events if event.get("reason") == "operator_skip"]
            self.assertEqual(len(skips), 1)
            self.assertEqual(skips[0]["track_id"], current)
            self.assertEqual(skips[0]["next_track_id"], second["id"])
            probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                    "-of", "default=nw=1:nk=1", str(output)],
                                   capture_output=True, text=True, check=True)
            self.assertAlmostEqual(float(probe.stdout), 11, delta=.2)
            subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(output),
                            "-f", "null", "-"], check=True)


if __name__ == "__main__":
    unittest.main()
