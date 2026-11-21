#!/usr/bin/env python3
"""Station One v2 policy acceptance tests. No audio/network/credentials used."""
import importlib.util
import random
import sys
import unittest
from unittest.mock import patch
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
        songs[8]["source"]="cloud"
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

    def test_bonus_spins_do_not_invade_original_cycle_edges(self):
        from scheduler_v2 import add_bonus_slots
        baseline=["s%02d"%i for i in range(18)]
        enhanced=add_bonus_slots(baseline,["s00","s08","s10","s12"],random.Random(7))
        self.assertEqual(enhanced[:4],baseline[:4])
        self.assertEqual(enhanced[-4:],baseline[-4:])

    def test_only_alternate_cuts_spaced_within_fair_bag(self):
        from scheduler_v2 import ShuffledBag
        bag = ShuffledBag(["cut-21s", "cut-42s", "independent"], random.Random(24))
        edit_group = lambda id_: "same-master" if id_.startswith("cut-") else id_
        first = bag.take({"same-master"}, edit_group)
        self.assertEqual(first, "independent", "Different master available in same bag")
        remaining = [bag.take({"same-master"}, edit_group) for _ in range(2)]
        self.assertEqual(set(remaining), {"cut-21s", "cut-42s"},
                         "Spacing cannot skip or duplicate an individual cut")

    def test_owner_attract_repel_preserve_music_inventory_and_duration(self):
        from scheduler_v2 import arrange_bumpers
        songs = [make_track("s"+str(i),duration=180) for i in range(7)]
        bumpers = [make_track("A",kind="bumper",duration=7),
                   make_track("X",kind="bumper",duration=36),
                   make_track("Y",kind="bumper",duration=42),
                   make_track("B",kind="bumper",duration=38),
                   make_track("Z",kind="bumper",duration=33)]
        by = {x["id"]: x for x in songs+bumpers}
        seq = ["s0","A","s1","X","s2","Y","s3","B","s4","Z","s5","s6"]
        output = arrange_bumpers(seq,by,[{"enabled":True,"kind":"attract",
            "track_ids":["A","B"]}],{"short":1,"medium":4,"long":0},near=2)
        self.assertEqual(output[3],"B")
        self.assertEqual({k:output.count(k) for k in seq},
                         {k:seq.count(k) for k in seq})
        self.assertEqual([k for k in seq if k.startswith("s")],
                         [k for k in output if k.startswith("s")])
        self.assertEqual(sum(by[k]["duration"] for k in seq),
                         sum(by[k]["duration"] for k in output))
        quiet = arrange_bumpers(seq,by,[{"enabled":False,"kind":"attract",
            "track_ids":["A","B"]}],{"short":1,"medium":4,"long":0},near=2)
        self.assertEqual(quiet,seq, "Disabled groups cannot move recordings")

    def test_opt_in_rules_are_disabled_unless_owner_activates(self):
        from scheduler_v2 import allowed_bumper
        day = datetime.fromisoformat("2026-11-18T18:00:00+00:00")
        night = datetime.fromisoformat("2026-11-18T05:00:00+00:00")
        hold = [{"kind":"hold","enabled":False,"track_ids":["bumper"]}]
        self.assertTrue(allowed_bumper("bumper",hold,day))
        hold[0]["enabled"] = True
        self.assertFalse(allowed_bumper("bumper",hold,day))
        window = [{"kind":"daypart","enabled":True,"track_ids":["bumper"],
                   "days":[3],"start_minute":540,"end_minute":1020}]
        self.assertTrue(allowed_bumper("bumper",window,day))
        self.assertFalse(allowed_bumper("bumper",window,night))
        self.assertTrue(allowed_bumper("bumper",window,night,clock=True),
                        "Fixed Same-Time clock ignores variable dayparts")
        dates = [{"kind":"date","enabled":True,"track_ids":["bumper"],
                  "start_date":"2026-11-19","end_date":"2026-12-04"}]
        self.assertFalse(allowed_bumper("bumper",dates,day))

    def test_ffmpeg_icecast_source_requires_tls(self):
        import engine
        with patch.object(engine.subprocess,"Popen") as popen:
            engine.output_process("icecast://source:demo@source.invalid:8443/humkin.mp3",128)
            command=popen.call_args.args[0]
            self.assertIn("-tls",command)
            self.assertEqual(command[command.index("-tls")+1],"1")
        with patch.object(engine.subprocess,"Popen") as popen:
            engine.output_process("test.mp3",128,realtime=False)
            command=popen.call_args.args[0]
            self.assertNotIn("-tls",command)

    def test_shorties_never_follow_consecutive_songs(self):
        songs = [make_track("music-%02d" % i, duration=180) for i in range(48)]
        shorts = [make_track("short-%d" % i, kind="bumper", duration=8 + i)
                  for i in range(3)]
        by_id = {track["id"]: track for track in songs + shorts}
        for cadence in (1, 4):
            for seed in (7, 29):
                rotation = with_bumpers([t["id"] for t in songs], by_id,
                                        {"bumper_every": cadence}, {},
                                        random.Random(seed))
                seen_songs = 0
                short_after = []
                for id_ in rotation:
                    if by_id[id_]["kind"] == "song":
                        seen_songs += 1
                    else:
                        short_after.append(seen_songs)
                self.assertTrue(short_after)
                self.assertTrue(all(n > 1 and
                    (i == 0 or n - short_after[i - 1] >= 2)
                    for i, n in enumerate(short_after)),
                    "Shorties need a non-shortie song gap, including across cycles")
                self.assertEqual(seen_songs, len(songs))

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

    def test_only_explicit_holds_and_invalid_duration_exclude_carts(self):
        policy=self.catalog["rotation"]["bumper_brain"]
        self.assertIsNone(bumper_lane(self.catalog["tracks"][-1],policy))
        announcement=make_track("clock",kind="bumper",duration=8)
        announcement["title"]="Top of the hour!"
        self.assertEqual(bumper_lane(announcement,{}),"short",
                         "Fictional title must not exclude approved art")
        opener=make_track("open",kind="bumper",duration=56)
        opener["title"]="Taken Minute Opener"
        self.assertEqual(bumper_lane(opener,{}),"medium",
                         "Show opener title must not create a hold")
        oversized=make_track("too-long",kind="bumper",duration=181)
        self.assertIsNone(bumper_lane(oversized,{}))

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

    def test_migrated_r2_crate_uses_current_public_file_not_legacy_bucket(self):
        import engine
        uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        sha = "b" * 64
        path = uid + "/" + sha + ".mp3"
        def record(id_, provider, key, kind="song", enabled=True):
            return {"id":id_, "title":"A Migrated Recording","artist":"HUMKIN",
                    "album":"INBOX","kind":kind,"enabled":enabled,
                    "is_single":False,"duration_seconds":130,
                    "storage_path":path,"storage_provider":provider,
                    "r2_object_key":key}
        cloud=[
            record("001","r2","tracks/Blue At The Tip.mp3"),
            record("002","r2","bad/../secret.mp3"),
            record("003","r2",None),
            record("004","supabase",None,kind="bumper"),
            record("005","r2","tracks/hidden.mp3",enabled=False)
        ]
        api=engine.API
        radio=engine.RADIO
        fixtures={
            engine.API+"/rest/v1/humkin_radio_art_assets?select=id,storage_path&limit=1000": [],
            radio+"rotation.json":{"tracks":[],"featured_rotation":{"multiplier":2}},
            api+"/rest/v1/humkin_radio_static_overrides?select=track_id,title,artist,album,kind,enabled,art_asset_id&limit=1000":[],
            api+"/rest/v1/humkin_radio_programs?select=id,name,days,start_minute,end_minute,track_ids,is_active,priority&is_active=eq.true&limit=100":[],
            api+"/rest/v1/humkin_radio_settings?select=bumper_every,station_label,bumper_groups,bumper_rules&id=eq.main&limit=1":[{"bumper_every":4}],
            radio+"air-carts.json":{"schema_version":"humkin.radio.air-carts/v1","carts":[]},
            radio+"r2-tracks.json":{"schema":"humkin.radio.r2/v1","tracks":[]},
            api+"/functions/v1/humkin-league":{"schema":"humkin.top42/v1","airchart":[]}
        }
        def fake_get_json(url, api=False):
            if "/rest/v1/humkin_radio_tracks?" in url:return cloud
            return fixtures[url]
        with patch.object(engine,"get_json",side_effect=fake_get_json):
            found=engine.live_catalog()
        self.assertEqual(set(t["id"] for t in found["tracks"]),
                         {"crate-001","crate-004"})
        migrated=next(t for t in found["tracks"] if t["id"]=="crate-001")
        self.assertEqual(migrated["url"],"https://media.abundent.org/tracks/Blue%20At%20The%20Tip.mp3")
        self.assertEqual(migrated["storage_provider"],"r2")
        old=next(t for t in found["tracks"] if t["id"]=="crate-004")
        self.assertTrue(old["url"].startswith(api+"/storage/v1/object/public/humkin-radio-live/"))
        self.assertEqual(old["kind"],"bumper")

    def test_r2_key_url_validation_rejects_private_path_escape(self):
        from catalog_sources import r2_public_url
        self.assertEqual(r2_public_url("tracks/song name.mp3"),
                         "https://media.abundent.org/tracks/song%20name.mp3")
        for key in ("tracks/../secret.mp3", "tracks//secret.mp3",
                    "tracks/secret.mp3?token=abc",
                    "https://private.example/secret.mp3", "", None):
            self.assertIsNone(r2_public_url(key),key)

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

