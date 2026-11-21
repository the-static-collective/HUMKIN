"""Radio House reports must be bounded, attributable and non-operational."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("radio_house_pulse", ROOT / "garden/radio_house_pulse.py")
pulse = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pulse)
GOOD_SHA = "a" * 40
BRANCH_SHA = "b" * 40


def evidence():
    return {
        "schema": "humkin.radiohouse.source-leads/v1",
        "components": [{"label": "Web radio", "path": "fm/radio.js", "reference": "https://github.com/example/HUMKIN/pull/1"}],
        "focus_branches": [{"branch": "experiment/trial", "question": "What is actually tested?"}]
    }


def snapshot():
    return {
        "coverage": "complete",
        "repository": "example/HUMKIN",
        "main_sha": GOOD_SHA,
        "main_event_at": "2026-11-21T15:18:34Z",
        "branches": [{"name": "main", "sha": GOOD_SHA},
                     {"name": "experiment/trial", "sha": BRANCH_SHA}],
        "open_prs": [{"number": 7, "title": "trial", "head": "experiment/trial",
                      "head_repo": "example/HUMKIN", "base": "integration/base"}]
    }


class RadioHousePulseTests(unittest.TestCase):
    def test_source_does_not_claim_deployment_or_hearing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "fm").mkdir()
            (root / "fm/radio.js").write_text("console.log('test')", encoding="utf-8")
            report, branches = pulse.render(snapshot(), evidence(), root)
        self.assertIn("PRESENT (source only)", report)
        self.assertIn("Runtime/deployment", report)
        self.assertIn("NOT CHECKED", report)
        self.assertIn("not established here", report)
        self.assertIn("integration/base", branches)
        self.assertIn("UNCLASSIFIED", branches)

    def test_absent_source_is_not_assumed_live(self):
        with tempfile.TemporaryDirectory() as temp:
            report, _ = pulse.render(snapshot(), evidence(), Path(temp))
        self.assertIn("NOT FOUND at this source cut", report)

    def test_partial_or_conflicting_api_inventory_is_rejected(self):
        broken = snapshot()
        broken["coverage"] = "unknown"
        with self.assertRaises(ValueError):
            pulse.render(broken, evidence(), ROOT)
        broken = snapshot()
        broken["branches"].append(dict(broken["branches"][0]))
        with self.assertRaises(ValueError):
            pulse.render(broken, evidence(), ROOT)
        broken = snapshot()
        broken["open_prs"].append(dict(broken["open_prs"][0]))
        with self.assertRaises(ValueError):
            pulse.render(broken, evidence(), ROOT)

    def test_branch_without_open_pr_does_not_become_merged(self):
        record = snapshot()
        record["open_prs"] = []
        _, branches = pulse.render(record, evidence(), ROOT)
        self.assertIn("No matching open PR; UNCLASSIFIED", branches)
        self.assertNotIn("MERGED", branches)

    def test_untrusted_branch_text_escaped_for_markdown(self):
        record = snapshot()
        record["branches"].append({"name": "experiment/with|table", "sha": "c" * 40})
        _, branches = pulse.render(record, evidence(), ROOT)
        self.assertIn("experiment/with\\|table", branches)

    def test_offline_cli_writes_two_files_without_api_call(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest = root / "garden/radio-house/evidence.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps(evidence()), encoding="utf-8")
            fixture = root / "fixture.json"
            fixture.write_text(json.dumps(snapshot()), encoding="utf-8")
            process = subprocess.run(
                [sys.executable, str(ROOT / "garden/radio_house_pulse.py"),
                 "--repo", "example/HUMKIN", "--root", str(root), "--snapshot", str(fixture)],
                capture_output=True, text=True
            )
            self.assertEqual(process.returncode, 0, process.stderr)
            self.assertTrue((root / "docs/CURRENT-SIGNAL.md").is_file())
            self.assertTrue((root / "docs/BRANCH-INVENTORY.md").is_file())

    def test_contracts_are_proposal_only_and_parseable(self):
        for kind in ("recording", "station", "program", "witness"):
            path = ROOT / f"core/contracts/{kind}.v1.schema.json"
            contract = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(contract["$schema"], "https://json-schema.org/draft/2020-12/schema")
            self.assertEqual(contract["type"], "object")
            self.assertFalse(contract["additionalProperties"])
            self.assertIn("schema", contract["required"])
            self.assertTrue(contract["properties"]["schema"]["const"].endswith("/v1"))


if __name__ == "__main__":
    unittest.main()
