#!/usr/bin/env python3
"""Station One v2 policy acceptance tests. No audio/network/credentials used."""
import importlib.util
import random
import sys
import unittest
from collections import Counter
from datetime import datetime
from pathlib import Path

MODULES = Path(__file__).resolve().parents[1] / "tools" / "radio-broadcast"
sys.path.insert(0,str(MODULES))
from scheduler_v2 import (StationV2, mix_eras, featured_extra, chart_extra,
                          bumper_lane, with_bumpers)
from catalog_sources import optional_catalog


def make_track(i, *, kind="song", album="INBOX", duration=180, **kw):
    return {"id":i, "title":i, "artist":"HUMKIN", "album":album,
            "kind":kind, "duration":duration, **kw}


class ProgrammingTests(unittest.TestCase):
    def setUp(self):
        songs=[make_track("s%02d" % i,album="RELEASE" if i<6 else "INBOX")
               for i in range(18)]
        songs[8]["is_single"]=True
        songs[10]["seasonal"]=True
        songs[10]["source"]="r2"
        bumpers=[make_track("short-a",kind="bumper",duration=7),
                 make_track("short-b",kind="bumper",duration=9),
                 make_track("medium",kind="bumper",duration=42),
                 make_track("long",kind="bumper",duration=95),
                 make_track("held",kind="bumper",duration=8,title_override="held")]
        bumpers[-1]["title"]="Owner hold"
        self.catalog={
            "tracks": songs+bumpers,
            "shows": [],
            "settings":{"bumper_every":4},
            "policy_version":2,
            "rotation":{
                "featured_rotation":{"multiplier":2,"albums":["RELEASE"],"singles":[]},
                "seasonal_rotation":{"multiplier":3,"track_ids":[]},
                "bumper_brain":{"short_max_seconds":19,"medium_max_seconds":60,
                    "medium_target_seconds":690,"long_target_seconds":1350,
                    "profiles":{"held":{"hold":True}}}},
            "chart_ids": []
        }

    def test_release_double_and_seasonal_triple(self):
        station=StationV2(self.catalog,seed=7)
        station._new_cycle()
        counts=Counter(station.queue)
        for i in range(6):self.assertEqual(counts["s%02d"%i],2)
        self.assertEqual(counts["s08"],2)
        self.assertEqual(counts["s10"],3)
        self.assertEqual(counts["s15"],1)
        self.assertEqual(counts["held"],0)
        self.assertGreater(counts["short-a"]+counts["short-b"],0)
        self.assertGreater(counts["medium"],0)
        self.assertGreater(counts["long"],0)

    def test_no_bumpers_when_off(self):
        self.catalog["settings"]["bumper_every"]=0
        station=StationV2(self.catalog)
        station._new_cycle()
        self.assertTrue(all(station.by_id[x]["kind"]=="song" for x in station.queue))

    def test_era_interleaving_never_loses_a_song(self):
        out=mix_eras(["s%02d"%i for i in range(60)],random.Random(55))
        self.assertEqual(len(out),60)
        self.assertEqual(len(set(out)),60)
        self.assertLessEqual(max(0,max(sum(1 for x in out[j:j+5] if int(x[1:])<20)
                         for j in range(56))),5)

    def test_review_hold_and_safety_claim(self):
        policy=self.catalog["rotation"]["bumper_brain"]
        self.assertIsNone(bumper_lane(self.catalog["tracks"][-1],policy))
        announcement=make_track("clock",kind="bumper",duration=8)
        announcement["title"]="Top of the hour!"
        self.assertIsNone(bumper_lane(announcement,{}))

    def test_chart_is_bounded_and_only_published_tracks(self):
        by_id={t["id"]:t for t in self.catalog["tracks"]}
        tracks=[x["id"] for x in self.catalog["tracks"] if x["kind"]=="song"]
        bonuses=chart_extra(tracks,by_id,["s00","unpublished","held","s01","s02"],random.Random(3))
        self.assertLessEqual(len(bonuses),3)
        self.assertTrue(set(bonuses).issubset({"s00","s01","s02"}))

    def test_weekday_priority(self):
        self.catalog["shows"]=[
            {"id":"morning","days":[2],"start_minute":0,"end_minute":1440,
             "is_active":True,"priority":1,"track_ids":["s04"]},
            {"id":"special","days":[2],"start_minute":0,"end_minute":1440,
             "is_active":True,"priority":2,"track_ids":["s07"]}
        ]
        station=StationV2(self.catalog,seed=1)
        # November 17 2026 is Tuesday in the station's Central timezone.
        self.assertEqual(station.next(datetime.fromisoformat("2026-11-17T19:30:00+00:00"))["id"],"s07")

    def test_only_approved_public_extras(self):
        longhash="a"*64
        catalog={
            "https://humkin.abundent.org/fm/air-carts.json":{
                "schema_version":"humkin.radio.air-carts/v1",
                "carts":[{"id":"field-fm-001","sha256":longhash,
                          "src":"./studio/recordings/hello.mp3",
                          "duration_seconds":7,"title":"Hello"},
                         {"id":"field-fm-002","sha256":longhash,
                          "src":"https://private.example/secret.mp3",
                          "duration_seconds":7,"title":"Forbidden"}]},
            "https://humkin.abundent.org/fm/r2-tracks.json":{
                "schema":"humkin.radio.r2/v1",
                "tracks":[{"id":"seasonal-001","approved":True,
                    "object_key":"radio/seasonal-one.mp3","duration_seconds":166,
                    "title":"Season One","seasonal":True},
                          {"id":"draft-001","approved":False,
                    "object_key":"radio/draft.mp3","duration_seconds":166,
                    "title":"Not approved"}]},
            "https://example.supabase.co/functions/v1/humkin-league":{
                "schema":"humkin.top42/v1",
                "airchart":[{"id":"r2-seasonal-001","plays":20}]}
        }
        tracks,chart=optional_catalog(lambda url:catalog[url],
                                      "https://humkin.abundent.org/fm/","https://example.supabase.co")
        self.assertEqual({t["id"] for t in tracks},{"air-field-fm-001","r2-seasonal-001"})
        self.assertEqual(chart,["r2-seasonal-001"])
        self.assertTrue(next(t for t in tracks if t["source"]=="r2")["seasonal"])


if __name__=="__main__":
    unittest.main()
