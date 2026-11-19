#!/usr/bin/env python3
"""Synthetic, offline HUMKIN catalogue mapping tests. No Suno API or native MOTIF run."""
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from humkin_catalog_map import (
    build_candidates, best_notes, map_styles, motif_cases, has_phrase,
    family_candidates, PUBLIC_SCHEMA
)

A="a"*64
B="b"*64
C="c"*64
def track(sha,title="Blue at the Tip",source="one.wav"):
    return {"mp3_sha256":sha,"source_sha256":source,
            "source_path":source,"filename":title.replace(" ","-")+".mp3",
            "title":title,"artist":"HUMKIN","album":"Radio",
            "duration_seconds":190,"embedded_genre":"Jazz"}

class CatalogueTests(unittest.TestCase):
    def test_human_and_suno_sources_are_distinct(self):
        manifest={"tracks":[track(A)]}
        notes=[{"mp3_sha256":A,"suno_style":"lo-fi jazz, warm electric piano, dreamy",
                "human_description":"A playful late-night instrumental",
                "tags":"mood:hopeful"}]
        record=build_candidates(manifest,notes)["tracks"][0]
        mapping={x["tag"]:x for x in record["suggestions"]}
        self.assertIn("genre:jazz",mapping)
        self.assertIn("texture:lo-fi",mapping)
        self.assertIn("mood:warm",mapping)
        self.assertEqual(record["metadata_provenance"]["notes_match"],"mp3_sha256")
        self.assertEqual(record["approved_for_tag_publication"],False)
        self.assertIn("suno_style",mapping["genre:jazz"]["evidence"][0]["source"]+
                      "".join(e["source"] for e in mapping["genre:jazz"]["evidence"]))
        self.assertIn("human_description",record["metadata_provenance"]["sources"])
    def test_no_invented_style_when_metadata_absent(self):
        manifest={"tracks":[{**track(A),"embedded_genre":""}]}
        record=build_candidates(manifest)["tracks"][0]
        self.assertEqual(record["suggestions"],[])
        self.assertFalse(record["approved_for_tag_publication"])
    def test_filename_collision_does_not_attach_notes(self):
        row=track(A)
        notes=[{"filename":row["filename"],"suno_style":"folk"},
               {"filename":row["filename"],"suno_style":"metal"}]
        result=build_candidates({"tracks":[row]},notes)["tracks"][0]
        self.assertEqual(result["metadata_provenance"]["notes_match"],"ambiguous:filename")
        self.assertNotIn("suno_style",result["metadata_provenance"]["sources"])
    def test_versions_are_hints_never_automatically_grouped(self):
        pack=build_candidates({"tracks":[track(A,"One Evening","a.wav"),
          {**track(B,"One Evening","b.wav"),"duration_seconds":205}]})
        self.assertEqual(pack["tracks"][0]["family_status"],"candidate_only")
        self.assertIn(B,pack["tracks"][0]["possible_family_hashes"])
        self.assertFalse(pack["tracks"][0]["approved_for_tag_publication"])
    def test_motif_questions_are_draft_not_native_results(self):
        record=build_candidates({"tracks":[{**track(A),"embedded_genre":""}]},
          [{"mp3_sha256":A,"suno_style":"jazz, folk"}])
        questions=motif_cases(record)
        self.assertEqual(len(questions),1)
        self.assertEqual(questions[0]["schema"],"motif.reason-case/v1")
        self.assertIn("NOT_RUN",questions[0]["context"])
        self.assertEqual(questions[0]["reports"],[])
    def test_explicit_embedded_style_and_bad_optional_sidecar(self):
        candidate=build_candidates({"tracks":[{
            **track(A),"embedded_genre":"","embedded_style":"ambient soundscape"}]})["tracks"][0]
        self.assertIn("genre:ambient",[x["tag"] for x in candidate["suggestions"]])
        import importlib.util
        import tempfile
        spec=importlib.util.spec_from_file_location("humkin_batch",
          str(Path(__file__).resolve().parents[1]/"tools"/"humkin-radio-batch.py"))
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            audio=Path(directory)/"Example.mp3"
            audio.write_bytes(b"just a sidecar parsing fixture")
            (Path(directory)/"Example.mp3.suno.json").write_text("{bad json",encoding="utf-8")
            self.assertEqual(module.sidecars(audio),{})
    def test_word_boundaries(self):
        self.assertFalse(has_phrase("rocket ship","rock"))
        self.assertTrue(has_phrase("warm indie rock","rock"))
        self.assertTrue(has_phrase("jazzy R&B vocals","r&b"))
if __name__=="__main__":
    unittest.main()
