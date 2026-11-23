"""Robot radio discovery contract: read-only until the owner proves a promotion."""
import json
import pathlib
import unittest
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "robots" / "manifest.json"
PORCH = ROOT / "robots" / "index.html"

class RobotRadioManifestTests(unittest.TestCase):
    def test_manifest_keeps_radio_read_only(self):
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(data["schema"], "humkin.robot-radio.discovery/v1")
        self.assertEqual(data["station_id"], "station-one")
        self.assertTrue(data["read_only"])
        for entry in data["read_only"].values():
            self.assertEqual(urlparse(entry["url"]).scheme, "https")
            self.assertTrue(entry["truth"])
        self.assertEqual(data["capability_flags"], {
            "public_mcp_deployed": False,
            "agent_write_actions_enabled": False,
            "autonomous_dj_broadcast_enabled": False,
            "public_suno_listening_evidence_enabled": False,
            "public_listener_analytics_imported": False,
        })
        self.assertIn("not", data["participation"]["listening_claims"].lower())
        self.assertIn("review", data["participation"]["public_music_analysis"].lower())
        self.assertIn("HUMKIN", data["provenance"]["authority"])

    def test_human_and_machine_links_exist_without_autoplay(self):
        page = PORCH.read_text(encoding="utf-8")
        self.assertIn('href="./manifest.json"', page)
        self.assertIn('href="../fm/"', page)
        self.assertIn("not deployed", page.lower())
        self.assertNotIn("autoplay", page.lower())
        self.assertNotIn("service_role", page.lower())

if __name__ == "__main__":
    unittest.main()
