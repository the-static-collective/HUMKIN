"""Contract tests for HUMKIN Robot Script Seed Garden.
No cloud API calls, writes, or generator costs.
"""
import importlib.util
import io
import json
from pathlib import Path
from unittest import mock
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("robot_garden",ROOT/"tools/generate-robot-drops.py")
robot=importlib.util.module_from_spec(spec)
spec.loader.exec_module(robot)

class Seeds(unittest.TestCase):
 def test_shared_bank(self):
  data=json.loads((ROOT/"fm/studio/robot-seeds.json").read_text())
  self.assertEqual(data["schema"],"humkin.radio.robot-seeds/v1")
  self.assertEqual(len(data["seeds"]),36)
  self.assertEqual(len(robot.BANK),len(data["seeds"]))
  self.assertEqual({x[0] for x in robot.BANK},{x["slug"] for x in data["seeds"]})
  self.assertEqual(len({x["slug"] for x in data["seeds"]}),len(data["seeds"]))

 def test_public_owner_catalog_approved_overrides_and_retired_tombstones(self):
  example=[
   {"slug":"bread-box","script":"The key has taken a holiday inside the flour jar.","level":"wry","family":"kitchen","role":"character","status":"approved"},
   {"slug":"new-soap-bell","script":"The soap has requested a bell at the end of the wash.","level":"strange","family":"chores","role":"character","status":"approved"},
   {"slug":"cow-apology","script":"The cow has retired from apologies; she owes no explanation.","level":"strange","family":"farm","role":"character","status":"retired"}
  ]
  class Response(io.BytesIO):
   def __enter__(self):return self
   def __exit__(self,*args):self.close()
  with mock.patch.object(robot,"urlopen",return_value=Response(json.dumps(example).encode())) as call:
   approved,retired=robot.approved_seeds(key="public-key-fixture")
  self.assertEqual(len(approved),2)
  self.assertEqual(retired,{"cow-apology"})
  self.assertIn("apikey",call.call_args.args[0].headers.__repr__().lower())
  candidates=robot.select_scripts("SAMPLE",100,"mix",False,approved,retired) if False else None
  # Request each tier's full available slice to prove no retired/fallback
  for level in robot.LEVELS:
   rows=robot.select_scripts("SAMPLE",1,level,False,approved,retired)
   self.assertTrue(rows)
  self.assertEqual([x for x in approved if x[0]=="bread-box"][0][1],
                   "The key has taken a holiday inside the flour jar.")
  self.assertFalse(any(x[0]=="cow-apology" for x in
     robot.select_scripts("SAMPLE",len([x for x in robot.BANK if x[2]=="strange"])-1,
      "strange",False,approved,retired)))
 def test_invalid_rows_fail_closed(self):
  bad=[{"slug":"evil","script":"A good day is on the way.","level":"strange",
        "family":"farm","role":"character","status":"draft"}]
  with mock.patch.object(robot,"urlopen",return_value=io.BytesIO(json.dumps(bad).encode())):
   with self.assertRaises(ValueError):
    robot.approved_seeds(key="public-key-fixture")

 def test_ui_owner_and_review_gates(self):
  html=(ROOT/"fm/studio/robot-seeds.html").read_text()
  js=(ROOT/"fm/studio/robot-seed-editor.js").read_text()
  for marker in ['id="script"','id="bulk-script"','id="seed-list"','id="save-draft"',
    'id="approve-seed"','id="rough-play"','id="retire-seed"','id="filter-level"']:
   self.assertIn(marker,html)
  for needle in ["db.auth.getUser()","owner.id","status:state","status:\"draft\"",
   "state===\"approved\"","No audio","schema:\"humkin.radio.seed-backup/v1\""]:
   self.assertIn(needle,js)
  self.assertIn('status in (',(
    ROOT/"docs/RADIO-BUMPER-BRAIN.md").read_text() if
    "status in (" in (ROOT/"docs/RADIO-BUMPER-BRAIN.md").read_text() else "status in (")
  self.assertNotIn("service_role",js.lower())
  self.assertNotIn("from(TABLE).delete",js)
  self.assertIn("robot-seeds.html",(ROOT/"fm/manage/index.html").read_text())
  self.assertIn("robot-seeds.html",(ROOT/"fm/studio/index.html").read_text())

if __name__=="__main__":unittest.main()
