import unittest
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"/"radio-broadcast"))
from program_deck import validate_packet, select_deck, schedule_guest, proposed_utc

ID="a192ba96-3ff2-48dc-b65f-64b0e082f6fa"
ACTOR="afaff7d4-3ded-4d48-923c-751b469b9c32"
UTC=timezone.utc

def reviewed(day="2026-11-23",time="20:00"):
 return {"schema":"humkin.program.reviewed/v1","id":ID,"state":"approved",
  "reviewed_by":ACTOR,"reviewed_at":"2026-11-19T12:00:00Z",
  "proposal":{"schema":"humkin.program.proposal/v1","title":"The Strange Hour",
  "station_id":"station-one","day":day,"time":time,"minutes":30,
  "rules":[{"when":"unheard","action":"least-played","enabled":True},
           {"when":"always","action":"surprise","enabled":True}],"note":"A quiet show"}}

def track(id,minutes=1):
 return {"id":id,"title":id,"artist":"HUMKIN","album":"album-"+id,
   "asset_sha":(id[:1]*64),"durations_ms":[8000]*(minutes*60//8)}

def house():
 return {"schema":"humkin.cloud-autopilot/v1","station_id":"station-one",
   "revisions":[{"id":"r-house","effective_at":"2026-11-20T00:00:00.000Z",
   "tracks":[track("a",2),track("b",2)]}]}

class ReviewedGambits(unittest.TestCase):
 def test_no_self_approval_or_arbitrary_frequency(self):
  packet=reviewed()
  self.assertEqual(validate_packet(packet,"station-one")[0]["title"],"The Strange Hour")
  for state in ("pending_review","rejected","",None):
   bad=deepcopy(packet);bad["state"]=state
   with self.assertRaises(ValueError):validate_packet(bad,"station-one")
  with self.assertRaises(ValueError):validate_packet(packet,"talk")
  bad=deepcopy(packet);bad["proposal"]["rules"][0]["action"]="shell"
  with self.assertRaises(ValueError):validate_packet(bad,"station-one")
  bad=deepcopy(packet);bad["proposal"]["rules"][0]["enabled"]=1
  with self.assertRaises(ValueError):validate_packet(bad,"station-one")

 def test_deterministic_real_approved_media_only(self):
  eligible=[track("a"),track("b"),track("c"),track("d")]
  first=select_deck(reviewed(),eligible,"station-one")
  second=select_deck(reviewed(),eligible,"station-one")
  self.assertEqual(first,second)
  self.assertGreaterEqual(sum(sum(t["durations_ms"]) for t in first),30*60000)
  self.assertTrue(all(t["id"] in {"a","b","c","d"} for t in first))
  self.assertEqual(len({t["id"] for t in first[:4]}),4)

 def test_guest_returns_home_without_computer_and_without_overwriting_old_revisions(self):
  packet=reviewed()
  base=house()
  guest=select_deck(packet,[track("c",2),track("d",2),track("e",2)],"station-one")
  result=schedule_guest(base,"station-one",guest,packet,
    now=datetime(2026,11,19,12,tzinfo=UTC))
  self.assertEqual(len(result["revisions"]),3)
  self.assertEqual(result["revisions"][0],base["revisions"][0])
  self.assertEqual(result["revisions"][1]["tracks"],guest)
  self.assertEqual(result["revisions"][2]["tracks"],base["revisions"][0]["tracks"])
  self.assertGreater(result["revisions"][2]["effective_at"],result["revisions"][1]["effective_at"])
  import autopilot_publisher as p
  start=p.clock_ms(result["revisions"][1]["effective_at"])
  stop=p.clock_ms(result["revisions"][2]["effective_at"])
  scheduled=proposed_utc(datetime(2026,11,23).date(),datetime.strptime("20:00","%H:%M").time())
  self.assertGreaterEqual(start,int(scheduled.timestamp()*1000))
  self.assertGreaterEqual(stop-start,30*60000)
  self.assertEqual(p.next_boundary(result["revisions"][0],start),start)
  self.assertEqual(p.next_boundary(result["revisions"][1],stop),stop)

 def test_guest_cannot_overlap_prebooked_future_program_or_start_in_the_past(self):
  packet=reviewed()
  base=house()
  base["revisions"][0]["effective_at"]="2026-11-24T04:00:00.000Z"
  with self.assertRaisesRegex(ValueError,"overlaps"):
   schedule_guest(base,"station-one",[track("c")],packet,
     now=datetime(2026,11,19,12,tzinfo=UTC))
  with self.assertRaisesRegex(ValueError,"three minutes"):
   schedule_guest(house(),"station-one",[track("c")],packet,
     now=datetime(2026,11,24,2,tzinfo=UTC))

 def test_daylight_saving_gap_is_rejected(self):
  with self.assertRaisesRegex(ValueError,"does not exist"):
   proposed_utc(datetime(2027,3,14).date(),datetime.strptime("02:30","%H:%M").time())

if __name__=="__main__": unittest.main()
