"""Robot Desk v2 editorial checks; no network, TTS install or publishing required."""
import importlib.util
import json
from pathlib import Path
import random
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("humkin_robot",ROOT/"tools/generate-robot-drops.py")
robot=importlib.util.module_from_spec(spec)
spec.loader.exec_module(robot)

class RobotDeskV2(unittest.TestCase):
 def test_taxonomy_evergreen_and_unique(self):
  self.assertEqual(set(robot.LEVELS),{"plain","wry","strange","cosmic"})
  self.assertEqual(set(robot.FINISHES),{"wire","warm","clear"})
  self.assertEqual(set(robot.ENGINES),{"espeak","flite","festival"})
  self.assertEqual(len(robot.BANK),len({x[0] for x in robot.BANK}))
  for level in robot.LEVELS:
   self.assertGreaterEqual(sum(x[2]==level for x in robot.BANK),8)
  for slug,script,level,family,role in robot.BANK:
   self.assertTrue(slug and script and family)
   self.assertNotIn("http",script.lower())
   self.assertLessEqual(len(script),126,"Radio drops should be short")
  self.assertTrue(any("neighbor" in x[1].lower() for x in robot.BANK))
  self.assertTrue(any("bread" in x[1].lower() for x in robot.BANK))
  self.assertTrue(any("HUMKIN RADIO" in x[1] for x in robot.BANK))
 def test_mix_is_deterministic_and_well_balanced(self):
  a=robot.select_scripts("WEEK-32",12,"mix",False)
  b=robot.select_scripts("WEEK-32",12,"mix",False)
  self.assertEqual(a,b)
  self.assertEqual(len({x[0] for x in a}),12)
  self.assertEqual({level:sum(x[2]==level for x in a) for level in robot.LEVELS},
                   {level:3 for level in robot.LEVELS})
  self.assertNotEqual(a,robot.select_scripts("WEEK-33",12,"mix",False))
 def test_levels_can_be_separately_requested(self):
  for level in robot.LEVELS:
   a=robot.select_scripts("SPECIAL",5,level,False)
   self.assertEqual(len(a),5)
   self.assertTrue(all(row[2]==level for row in a))
 def test_engines_are_declared_not_faked(self):
  # Test strict failure rather than silently pretending 3 available voices.
  original=robot.engine_available
  robot.engine_available=lambda e:e=="espeak"
  try:
   self.assertEqual(robot.available_engines("auto"),["espeak"])
   with self.assertRaises(ValueError): robot.available_engines("espeak,flite")
   with self.assertRaises(ValueError): robot.available_engines("espeak,espeak")
   with self.assertRaises(ValueError): robot.available_engines("other")
  finally:robot.engine_available=original
 def test_review_page_no_network_or_live_code(self):
  manifest={"items":[
    {"file":"robot-test.mp3","slug":"quoted-title","script":"Bread & <chairs>.",
     "absurdity":"wry","engine":"espeak","finish":"warm","seconds":4.2,"group":"weekly-original"}]}
  page=robot.html_index(manifest)
  self.assertIn("&lt;chairs&gt;",page)
  self.assertIn("<audio controls",page)
  self.assertNotIn("<chairs>",page)
  self.assertNotIn("https://",page)
 def test_workflow_permanent_review_gate(self):
  workflow=(ROOT/".github/workflows/robot-desk-auditions.yml").read_text()
  self.assertIn("espeak flite festival ffmpeg",workflow)
  self.assertIn("upload-artifact@v4",workflow)
  self.assertIn("--compare",workflow)
  for banned in ("git push","SUPABASE_SERVICE_ROLE","curl -X POST","storage/v1/object"):
   self.assertNotIn(banned,workflow)
  # No audit/safety bypass in the radio renderer.
  src=(ROOT/"tools/generate-robot-drops.py").read_text()
  for banned in ("supabase","storage/v1","twitter.com","text-generation-api"):
   self.assertNotIn(banned,src.lower().replace("no supabase or publishing writes", ""))
if __name__=="__main__": unittest.main()
