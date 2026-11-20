#!/usr/bin/env python3
"""Offline TOWER saved show -> owner-reviewed Cloud Autopilot handoff acceptance."""
from copy import deepcopy
from contextlib import redirect_stdout
from io import StringIO
from unittest.mock import patch
from datetime import datetime, timezone, timedelta
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1] / "tools" / "radio-broadcast"
sys.path.insert(0, str(ROOT))
from on_air import Desk, serve
from scheduler_v2 import StationV2
from tower_library import TowerLibrary
from tower_cloud_handoff import (
    SCHEMA, checked_slot, export_handoff, schedule_curated,
    validate_handoff, validate_prepared,
)
from autopilot_publisher import next_boundary, clock_ms

UTC = timezone.utc
SLOT = {"day": "2030-01-02", "time": "20:00"}


def setup_station(root):
    root = Path(root)
    crate = TowerLibrary(root / "crate", "station-one")
    sources = []
    for i in (1, 2):
        raw = (f"test-audio-{i}".encode()) * 100
        digest = sha256(raw).hexdigest()
        path = crate.media / (digest + ".mp3")
        path.write_bytes(raw)
        sources.append({
            "id": "upload-" + digest, "title": f"Original {i}", "artist": "HUMKIN",
            "kind": "song", "duration": 120, "source": "upload",
            "local_audio": str(path), "album": "The Field"
        })
    station = StationV2({"policy_version": 2, "tracks": sources,
                         "shows": [], "settings": {}})
    desk = Desk(station, root / "programming.json", tower=crate)
    desk.act({"action": "program_save", "program": {
        "name": "Other People's Fire", "notes": "Open, then repeat first",
        "track_ids": [sources[1]["id"], sources[0]["id"], sources[1]["id"]]}})
    program = desk.view()["programs"][0]
    return desk, program, sources


def draft(desk, program):
    return export_handoff(desk, {
        "program_id": program["id"], "revision": program["revision"],
        **SLOT
    })


def prepared(packet):
    tracks = []
    for index, item in enumerate(packet["crate"]["tracks"]):
        tracks.append({
            "id": item["id"], "title": item["title"],
            "artist": item["artist"], "album": item["album"],
            "asset_sha": item["expected_sha"], "durations_ms": [8000] * (8 + index)
        })
    return tracks


def house():
    home = {"id": "house", "title": "House", "artist": "HUMKIN",
            "asset_sha": "a" * 64, "durations_ms": [8000] * 15}
    return {"schema": "humkin.cloud-autopilot/v1", "station_id": "station-one",
            "revisions": [{"id": "r-house", "effective_at": "2029-12-29T00:00:00.000Z",
                           "tracks": [home]}]}


class TowerCloudHandoffTests(unittest.TestCase):
    def test_private_handoff_preserves_order_and_does_not_change_local_queue(self):
        with tempfile.TemporaryDirectory() as folder:
            desk, program, sources = setup_station(folder)
            packet = draft(desk, program)
            self.assertEqual(packet["schema"], SCHEMA)
            self.assertEqual(packet["state"], "draft_for_owner_review")
            self.assertEqual(packet["slot"], {**SLOT, "timezone": "America/Chicago"})
            self.assertEqual(packet["program"]["track_ids"],
                             [sources[1]["id"], sources[0]["id"], sources[1]["id"]])
            self.assertEqual([item["id"] for item in packet["crate"]["tracks"]],
                             packet["program"]["track_ids"])
            self.assertTrue(all(Path(item["path"]).is_file() for item in packet["crate"]["tracks"]))
            self.assertTrue(all(item["expected_sha"] == item["id"][7:]
                                for item in packet["crate"]["tracks"]))
            self.assertEqual(validate_handoff(packet)[0], "station-one")
            self.assertEqual(desk.state["lineup"], [])
            self.assertEqual(desk.view()["programs"][0], program)
            self.assertEqual(draft(Desk(StationV2({
                "tracks": [dict(item) for item in sources]}),
                Path(folder) / "programming.json",
                tower=TowerLibrary(Path(folder) / "crate", "station-one")), program),
                packet)

    def test_exact_order_house_restore_and_no_overlap(self):
        with tempfile.TemporaryDirectory() as folder:
            desk, program, sources = setup_station(folder)
            packet = draft(desk, program)
            media = prepared(packet)
            self.assertGreater(validate_prepared(packet, media), 0)
            base = house()
            result = schedule_curated(base, "station-one", media, packet,
                                      now=datetime(2029, 12, 30, tzinfo=UTC))
            self.assertEqual(len(result["revisions"]), 3)
            self.assertEqual(result["revisions"][0], base["revisions"][0])
            self.assertEqual(result["revisions"][1]["tracks"], media)
            self.assertEqual(result["revisions"][2]["tracks"], base["revisions"][0]["tracks"])
            self.assertEqual(result["revisions"][1]["id"][:2], "g-")
            start = clock_ms(result["revisions"][1]["effective_at"])
            stop = clock_ms(result["revisions"][2]["effective_at"])
            self.assertEqual(next_boundary(base["revisions"][0], start), start)
            self.assertEqual(stop - start, sum(sum(t["durations_ms"]) for t in media))
            self.assertGreaterEqual(start, round(checked_slot(SLOT["day"], SLOT["time"]).timestamp() * 1000))
            with self.assertRaisesRegex(ValueError, "overlaps"):
                schedule_curated(result, "station-one", media, packet,
                                 now=datetime(2029, 12, 30, tzinfo=UTC))

    def test_stale_draft_changed_source_bad_order_and_missing_audio_refuse(self):
        with tempfile.TemporaryDirectory() as folder:
            desk, program, sources = setup_station(folder)
            packet = draft(desk, program)
            desk.act({"action": "program_save", "program": {
                "id": program["id"], "revision": program["revision"],
                "name": "Changed", "notes": "", "track_ids": [sources[0]["id"]]}})
            with self.assertRaisesRegex(ValueError, "changed"):
                draft(desk, program)
            broken = deepcopy(packet)
            broken["program"]["name"] = "Altered after export"
            with self.assertRaisesRegex(ValueError, "changed after export"):
                validate_handoff(broken)
            changed_order = deepcopy(packet)
            changed_order["program"]["track_ids"][0] = sources[0]["id"]
            with self.assertRaisesRegex(ValueError, "lost its saved running order"):
                validate_handoff(changed_order)
            media = prepared(packet)
            media[1]["asset_sha"] = "0" * 64
            with self.assertRaisesRegex(ValueError, "Source audio changed"):
                validate_prepared(packet, media)
            media = prepared(packet)
            media[0], media[1] = media[1], media[0]
            with self.assertRaisesRegex(ValueError, "order differs"):
                validate_prepared(packet, media)
            Path(sources[0]["local_audio"]).unlink()
            with self.assertRaisesRegex(ValueError, "missing"):
                export_handoff(desk, {"program_id": program["id"], "revision": 2, **SLOT})

    def test_hold_remote_only_invalid_clock_and_invalid_frequency(self):
        with tempfile.TemporaryDirectory() as folder:
            desk, program, sources = setup_station(folder)
            packet = draft(desk, program)
            with self.assertRaisesRegex(ValueError, "frequency"):
                schedule_curated(house(), "talk", prepared(packet), packet,
                                 now=datetime(2029, 12, 30, tzinfo=UTC))
            with self.assertRaisesRegex(ValueError, "quarter-hour"):
                checked_slot("2030-01-02", "20:07")
            with self.assertRaisesRegex(ValueError, "does not exist"):
                checked_slot("2027-03-14", "02:30")
            desk.act({"action": "hold", "id": sources[1]["id"]})
            with self.assertRaisesRegex(ValueError, "unavailable or held"):
                draft(desk, program)
            desk.act({"action": "hold", "id": sources[1]["id"]})
            # All locally available upload files exist; remote-only references must fail.
            desk.station.by_id[sources[0]["id"]].pop("local_audio")
            with self.assertRaisesRegex(ValueError, "remote-only"):
                draft(desk, program)

    def test_cli_preview_accepts_export_without_any_publish(self):
        import autopilot_publisher as autopilot
        with tempfile.TemporaryDirectory() as folder:
            desk, program, _ = setup_station(folder)
            packet = draft(desk, program)
            handoff_file = Path(folder) / "cloud-handoff.json"
            handoff_file.write_text(json.dumps(packet), encoding="utf-8")
            output = StringIO()
            with patch.object(autopilot, "prepare_tracks",
                              return_value=("station-one", prepared(packet))) as prep:
                with patch.object(sys, "argv", [
                        "autopilot_publisher.py", "--tower-program",
                        str(handoff_file)]):
                    with redirect_stdout(output):
                        autopilot.main()
            prep.assert_called_once()
            self.assertIn("PREVIEW ONLY", output.getvalue())
            self.assertIn("Running order preserved", output.getvalue())
            self.assertEqual(desk.state["lineup"], [])

    def test_private_http_action_returns_handoff_and_rejects_foreign_origin(self):
        with tempfile.TemporaryDirectory() as folder:
            desk, program, _ = setup_station(folder)
            server, origin = serve(desk, 0)
            try:
                with urlopen(origin, timeout=2) as response:
                    html = response.read().decode()
                token = re.search(r'name="station-control" content="([^"]+)"', html)[1]
                body = json.dumps({"action": "program_cloud_handoff",
                    "program_id": program["id"], "revision": program["revision"],
                    **SLOT}).encode()
                headers = {"X-Station-Control": token, "Origin": origin,
                           "Content-Type": "application/json"}
                with urlopen(Request(origin + "/action", body, headers), timeout=2) as response:
                    data = json.load(response)
                self.assertEqual(data["handoff"]["schema"], SCHEMA)
                self.assertNotIn("state", data)
                self.assertEqual(desk.state["lineup"], [])
                with self.assertRaises(HTTPError) as error:
                    urlopen(Request(origin + "/action", body,
                                    headers | {"Origin": "https://evil.invalid"}), timeout=2)
                self.assertEqual(error.exception.code, 403)
            finally:
                server.unregister_desk()
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    unittest.main()
