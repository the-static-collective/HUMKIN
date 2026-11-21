#!/usr/bin/env python3
"""TOWER 011: no-internet acceptance tests for durable encoded media."""
from contextlib import contextmanager
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"/"radio-broadcast"))
import tower_asset_store as store
import cloud_house_sync as cloud
import autopilot_publisher as publisher


class Missing(Exception):
    response={"ResponseMetadata":{"HTTPStatusCode":404}}


class FakeR2:
    def __init__(self):
        self.objects={}
        self.operations=[]
        self.head_calls=0

    def get_object(self, Bucket, Key):
        self.operations.append(("get",Key))
        if Key not in self.objects:
            raise Missing()
        return {"Body":BytesIO(self.objects[Key])}

    def head_object(self, Bucket, Key):
        self.operations.append(("head",Key))
        self.head_calls+=1
        if Key not in self.objects:
            raise Missing()
        return {"ContentLength":len(self.objects[Key])}

    def upload_file(self, filename, bucket, key, ExtraArgs=None):
        self.operations.append(("upload",key))
        self.objects[key]=Path(filename).read_bytes()

    def put_object(self, Bucket, Key, Body, **kwargs):
        self.operations.append(("put",Key))
        self.objects[Key]=Body


def sample(digest):
    return {"id":"10000000-0000-4000-8000-"+digest[:12],
            "sha256":digest,"r2_object_key":"tracks/10000000-0000-4000-8000-"+digest[:12]+"/"+digest+".mp3",
            "title":"Sample","artist":"HUMKIN","album":"INBOX"}


def fake_encode(src,digest,cache):
    folder=Path(cache)/digest
    folder.mkdir(parents=True,exist_ok=True)
    for i in range(3):
        (folder/f"segment-{i:06d}.ts").write_bytes((digest+str(i)).encode()*3)
    return [8000,8000,8000]


@contextmanager
def fake_download(url,source,cache,expected_sha=None):
    assert expected_sha in url
    yield Path("/tmp/approved.mp3"),expected_sha


class AssetStoreTests(unittest.TestCase):
    def setUp(self):
        self.client=FakeR2()
        self.a=sha256(b"song-a").hexdigest()
        self.b=sha256(b"song-b").hexdigest()
        self.selection={"station_id":"station-one",
                        "tracks":[sample(self.a),sample(self.a),sample(self.b)]}

    def test_per_asset_marker_last_and_reuse_after_runner_crash(self):
        calls=[]
        def crash_after_first(src,digest,cache):
            calls.append(digest)
            if digest==self.b:
                raise RuntimeError("runner interrupted after first asset")
            return fake_encode(src,digest,cache)
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(RuntimeError,"interrupted"):
                cloud.prepare_delta(self.selection,None,temp,client=self.client,
                                    durable=True,downloader=fake_download,
                                    encode=crash_after_first)
            marker=store.key_for_manifest(self.a)
            self.assertIn(marker,self.client.objects)
            self.assertNotIn(store.key_for_manifest(self.b),self.client.objects)
            self.assertNotIn("autopilot/programs/station-one.json",self.client.objects)
            first_write=[i for i,(op,key) in enumerate(self.client.operations)
                         if op=="put" and key==marker][0]
            self.assertEqual(sum(op=="upload" for op,key in self.client.operations[:first_write]),3)
        with tempfile.TemporaryDirectory() as temp:
            next_calls=[]
            def second_encode(src,digest,cache):
                next_calls.append(digest)
                return fake_encode(src,digest,cache)
            tracks,counts=cloud.prepare_delta(self.selection,None,temp,
                client=self.client,durable=True,downloader=fake_download,encode=second_encode)
            self.assertEqual(next_calls,[self.b])
            self.assertEqual(counts["new_source_encodes"],1)
            self.assertEqual(counts["reused_source_encodes"],1)
            self.assertEqual(counts["durable_checkpoints"],1)
            self.assertEqual(counts["segments"],9)
            self.assertEqual([x["asset_sha"] for x in tracks],[self.a,self.a,self.b])
            self.assertTrue(store.read_manifest(self.client,self.b))

    def test_old_segments_are_never_overwritten_with_conflicting_bytes(self):
        self.client.objects[store.segment_key(self.a,0)]=b"wrong-existing-bytes"
        with tempfile.TemporaryDirectory() as temp:
            fake_encode(None,self.a,temp)
            with self.assertRaisesRegex(ValueError,"conflicts|checksum mismatch"):
                store.publish_asset(self.client,self.a,[8000]*3,temp,workers=2)
        self.assertEqual(self.client.objects[store.segment_key(self.a,0)],b"wrong-existing-bytes")
        self.assertNotIn(store.key_for_manifest(self.a),self.client.objects)

    def test_manifest_malformed_profile_and_segment_receipts_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            fake_encode(None,self.a,temp)
            store.publish_asset(self.client,self.a,[8000]*3,temp)
        key=store.key_for_manifest(self.a)
        manifest=json.loads(self.client.objects[key])
        for mutation in [
            {"profile":"new-unreviewed-encoder"},
            {"source_sha256":"b"*64},
            {"segments":[{"index":0,"milliseconds":7,"bytes":1,"sha256":"b"*64}]},
        ]:
            bad=dict(manifest,**mutation)
            self.client.objects[key]=json.dumps(bad).encode()
            with self.assertRaises(ValueError):
                store.read_manifest(self.client,self.a)
        self.client.objects[key]=json.dumps(manifest).encode()
        self.assertEqual(store.read_manifest(self.client,self.a)[1],[8000]*3)
        with self.assertRaisesRegex(ValueError,"contradicts"):
            store.read_manifest(self.client,self.a,[8000,8000])

    def test_legacy_r2_assets_gain_markers_without_ffmpeg_or_new_program(self):
        for i in range(3):
            self.client.objects[store.segment_key(self.a,i)]=b"legacy-audio"+str(i).encode()
        legacy=store.certify_legacy_asset(self.client,self.a,[8000]*3)
        self.assertEqual(legacy["state"],"certified_without_reencoding")
        self.assertEqual(store.read_manifest(self.client,self.a)[1],[8000]*3)
        self.assertNotIn("autopilot/programs/station-one.json",self.client.objects)
        self.client.objects.pop(store.key_for_manifest(self.a))
        # Inactive or unapproved rows can never be backfilled automatically.
        old={"schema":publisher.SCHEMA,"station_id":"station-one",
             "revisions":[{"id":"r-legacy","effective_at":publisher.iso(datetime.now(timezone.utc)),
                           "tracks":[{"id":"song-a","asset_sha":self.a,
                                      "durations_ms":[8000]*3}]}]}
        self.assertEqual(cloud.backfill_previous(self.client,old,[{
            "sha256":self.a,"enabled":False,"published_at":None,"storage_provider":"r2"}]),0)
        self.assertNotIn(store.key_for_manifest(self.a),self.client.objects)
        approved={"sha256":self.a,"enabled":True,"published_at":"2026-11-21",
                  "storage_provider":"r2"}
        self.assertEqual(cloud.backfill_previous(self.client,old,[approved],limit=1),1)
        self.assertEqual(cloud.backfill_previous(self.client,old,[approved],limit=1),0)
        self.assertIn(store.key_for_manifest(self.a),self.client.objects)

    def test_publisher_uses_verified_marker_without_head_per_piece(self):
        with tempfile.TemporaryDirectory() as temp:
            fake_encode(None,self.a,temp)
            store.publish_asset(self.client,self.a,[8000]*3,temp)
            now=datetime.now(timezone.utc)
            tracks=[{"id":"r2-"+sample(self.a)["id"],"title":"Sample","artist":"HUMKIN",
                     "album":"INBOX","artwork":"","asset_sha":self.a,
                     "durations_ms":[8000]*3}]
            program={"schema":publisher.SCHEMA,"station_id":"station-one",
                     "revisions":[{"id":"revision-1","effective_at":publisher.iso(now),
                                   "tracks":tracks}]}
            fake_botocore=types.ModuleType("botocore")
            fake_exceptions=types.ModuleType("botocore.exceptions")
            fake_exceptions.ClientError=Missing
            fake_botocore.exceptions=fake_exceptions
            self.client.operations.clear()
            with patch.dict(sys.modules,{"botocore":fake_botocore,
                                          "botocore.exceptions":fake_exceptions}):
                publisher.publish_program(program,Path(temp),self.client)
            self.assertIn("autopilot/programs/station-one.json",self.client.objects)
            # Read all three segment positions would be three HEADs. A
            # certified asset gets only first/last verification (two).
            self.assertEqual(len([x for x in self.client.operations if
                                  x[0]=="head" and "/segments/" in x[1]]),2)
            self.assertFalse(any(x[0]=="upload" for x in self.client.operations))
            self.assertEqual(self.client.operations[-1][0],"put")

if __name__=="__main__":
    unittest.main()
