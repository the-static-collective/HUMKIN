#!/usr/bin/env python3
"""TOWER 010 acceptance: command authority is not an on-air receipt."""
import json
from hashlib import sha256
from pathlib import Path
import sys
import tempfile
from unittest import TestCase, main
from unittest.mock import patch
from datetime import datetime, timedelta, timezone

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"/"radio-broadcast"))
import house_rotation
import tower_living_control as ctl
import cloud_house_sync as cloud
import autopilot_publisher as publisher

SETTINGS={"bumper_every":4,"bumper_groups":[],"bumper_rules":[]}
POLICY={"short_max_seconds":19,"medium_max_seconds":60,"feature_only_spoken_sha256s":[]}
ROTATION={"featured_rotation":{"multiplier":2,"albums":[],"singles":[]},
          "seasonal_rotation":{"multiplier":3,"track_ids":[],"sha256s":[]}}


def source(uid,kind="song",duration=180.0):
    ident=sha256(uid.encode()).hexdigest()
    return {"id":uid,"sha256":ident,"r2_object_key":f"tracks/{uid}/{ident}.mp3",
            "title":"Track "+uid[-2:],"artist":"HUMKIN","album":"INBOX",
            "duration_seconds":duration,"kind":kind,"enabled":True,
            "published_at":"2026-11-21T00:00:00+00:00",
            "storage_provider":"r2","is_single":False}


def rows():
    return ([source(f"a0000000-0000-4000-8000-{i:012d}") for i in range(8)]+
            [source(f"b0000000-0000-4000-8000-{i:012d}","bumper",8.0+i) for i in range(2)])


def request(seq,item,action):
    return {"id":seq,"track_id":item["id"],"action":action,
            "requested_at":"2026-11-21T01:00:00Z"}


class LivingControlTest(TestCase):
    def setUp(self):
        self.rows=rows()
        self.patches=[
            patch.object(house_rotation,"public_bumper_settings",return_value=SETTINGS),
            patch.object(house_rotation,"local_bumper_policy",return_value=POLICY),
            patch.object(house_rotation,"local_rotation_policy",return_value=ROTATION),
            patch.object(ctl,"public_bumper_settings",return_value=SETTINGS),
            patch.object(ctl,"local_bumper_policy",return_value=POLICY),
        ]
        for item in self.patches:
            item.start();self.addCleanup(item.stop)
        self.base=house_rotation.make_selection(self.rows,count="FULL")

    def compiled(self,commands=(),prior=None,rows_override=None):
        return ctl.compile_controls(self.base,rows_override or self.rows,
                                    prior,list(commands),
                                    settings=SETTINGS,bumper_policy=POLICY)

    def test_no_commands_preserves_exact_original_bumper_brain_rotation(self):
        selected,state=self.compiled()
        self.assertEqual(selected["tracks"],self.base["tracks"])
        self.assertEqual(state["cursor"],0)
        self.assertEqual(state["weights"],{})
        self.assertEqual(house_rotation.fingerprint(selected),selected["fingerprint"])

    def test_explicit_queue_boundaries_and_weights_without_audio_reencode(self):
        song=self.rows[0]
        other=self.rows[1]
        actions=[request(1,song,"more"),request(2,other,"queue_next"),
                 request(3,song,"queue_end")]
        selected,state=self.compiled(actions)
        self.assertEqual(state["cursor"],3)
        self.assertEqual(state["weights"][song["id"]],1)
        self.assertEqual(selected["tracks"][0]["id"],other["id"])
        self.assertEqual(selected["tracks"][-1]["id"],song["id"])
        self.assertEqual(sum(t["id"]==song["id"] for t in selected["tracks"]),
                         sum(t["id"]==song["id"] for t in self.base["tracks"])+2)
        self.assertTrue(all("durations_ms" not in t for t in selected["tracks"]))
        self.assertLessEqual(len(selected["tracks"]),500)

    def test_hold_release_and_weight_counter_are_persistent_and_bounded(self):
        song=self.rows[3]
        selected,state=self.compiled([request(1,song,"more"),
                                      request(2,song,"hold")])
        self.assertTrue(all(t["id"]!=song["id"] for t in selected["tracks"]))
        self.assertEqual(state["weights"][song["id"]],1)
        self.assertIn(song["id"],state["holds"])
        restored,again=self.compiled([request(3,song,"release")],prior=state)
        self.assertNotIn(song["id"],again["holds"])
        self.assertEqual(sum(t["id"]==song["id"] for t in restored["tracks"]),2)
        with self.assertRaisesRegex(ValueError,"already at its limit"):
            self.compiled([request(1,song,"more"),request(2,song,"more"),
                           request(3,song,"more")])
        with self.assertRaisesRegex(ValueError,"Malformed|Out-of-order"):
            self.compiled([request(3,song,"more"),request(2,song,"less")])

    def test_revocation_and_unsupported_bumper_weight_hold_without_a_receipt(self):
        revoked=[dict(r) for r in self.rows]
        revoked[0]["enabled"]=False
        with self.assertRaisesRegex(ValueError,"revoked"):
            self.compiled([request(1,self.rows[0],"queue_next")],
                          rows_override=revoked)
        with self.assertRaisesRegex(ValueError,"Bumper rotation weights"):
            self.compiled([request(1,self.rows[-1],"more")])

    def test_existing_state_is_idempotent_and_command_cursor_prevents_replay(self):
        prior={"schema":ctl.SCHEMA,"cursor":7,"holds":[self.rows[0]["id"]],
               "weights":{self.rows[1]["id"]:1}}
        resumed,receipt=self.compiled([],prior=prior)
        self.assertEqual(receipt["cursor"],7)
        self.assertIn(self.rows[0]["id"],receipt["holds"])
        self.assertNotIn(self.rows[0]["id"],[r["id"] for r in resumed["tracks"]])
        with self.assertRaisesRegex(ValueError,"Out-of-order"):
            self.compiled([request(7,self.rows[2],"queue_next")],prior=prior)

    def test_cloud_sync_commits_receipt_only_with_protected_r2_program_pointer(self):
        old={"schema":publisher.SCHEMA,"station_id":"station-one","revisions":[
            {"id":"prior","effective_at":publisher.iso(datetime.now(timezone.utc)-timedelta(days=2)),
             "tracks":[{"id":"previous","title":"Previous song","artist":"HUMKIN","album":"",
                        "artwork":"","asset_sha":"a"*64,"durations_ms":[8000]}]}]}
        class Client:
            def get_object(self,**kwargs):
                from io import BytesIO
                return {"Body":BytesIO(json.dumps(old).encode())}
        def prepared(selection,previous,cache,**kwargs):
            return ([{"id":"r2-"+r["id"],"title":r["title"],
                      "artist":r["artist"],"album":r["album"],
                      "artwork":"","asset_sha":r["sha256"],
                      "durations_ms":[8000]} for r in selection["tracks"]],
                     {"new_source_encodes":0,"reused_source_encodes":10,
                      "program_entries":len(selection["tracks"]),"segments":len(selection["tracks"])})
        calls=[]
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(cloud,"prepare_delta",side_effect=prepared), \
                 patch.object(cloud,"publish_program",side_effect=lambda *a,**k:calls.append(a[0])):
                done=cloud.sync(client=Client(),cache=folder,selection=self.base,
                                read_catalog=lambda:self.rows,
                                read_intents=lambda cursor:[request(1,self.rows[1],"queue_next")],
                                living_control=True,commit=True)
        self.assertEqual(done["control_cursor"],1)
        self.assertEqual(len(calls),1)
        self.assertEqual(calls[0]["revisions"][-1]["control"]["cursor"],1)
        self.assertEqual(calls[0]["revisions"][-1]["tracks"][0]["id"],"r2-"+self.rows[1]["id"])


if __name__=="__main__":
    main()
