#!/usr/bin/env python3
"""HUMKIN Radio → hosted AzuraCast: review-first media transfer bridge.

By default only prints a *review manifest* of public HUMKIN recordings.
Upload is one approved owned/licensed recording at a time, with explicit
confirmation, and requires a separately provisioned AzuraCast instance.
No station is provisioned, purchased, connected or activated by this script.
"""
import argparse
import base64
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import engine
from host_preflight import public_https

VERSION="humkin.radio-host-transfer/v1"
MAX_BYTES=50*1024*1024
ID=re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,140}$")

def source_allowed(url):
    p=urllib.parse.urlsplit(str(url))
    if p.scheme!="https" or p.username or p.password or p.fragment:
        return False
    if p.hostname=="humkin.abundent.org":
        return p.path.endswith(".mp3") and p.path.startswith(("/fm/","/audio/","/releases/"))
    return (p.hostname=="kbhqacsdvjsstzyplqij.supabase.co" and
        p.path.startswith("/storage/v1/object/public/humkin-radio-live/") and p.path.endswith(".mp3"))

def new_manifest(catalog):
    result=[]
    for t in catalog.get("tracks",[]):
        if not ID.fullmatch(str(t.get("id",""))) or not source_allowed(t.get("url")):
            continue
        result.append({
         "id":t["id"],"title":t.get("title",""),"artist":t.get("artist","HUMKIN"),
         "kind":t.get("kind","song"),"source_url":t["url"],
         "duration":t.get("duration"),"rights":"needs_human_review",
         "permission_ref":"","broadcast_use":"internet_radio"
        })
    return {"version":VERSION,"station":"HUMKIN RADIO",
      "status":"review_only_not_yet_uploaded","tracks":result,
      "warning":"Do not mark Kinship or Rock Impact audio as HUMKIN-owned. Explicit permission and station rights review required."}

def checked_entry(manifest,target_id):
    if manifest.get("version")!=VERSION or not isinstance(manifest.get("tracks"),list):
        raise ValueError("Unknown radio transfer manifest format.")
    matches=[t for t in manifest["tracks"] if t.get("id")==target_id]
    if len(matches)!=1:raise ValueError("Choose exactly one approved track ID.")
    track=matches[0]
    if not ID.fullmatch(str(target_id)) or not source_allowed(track.get("source_url")):
        raise ValueError("Blocked: source URL or media ID outside owned public HUMKIN audio.")
    if track.get("rights")!="cleared_for_internet_radio" or len(str(track.get("permission_ref","")).strip())<5:
        raise ValueError("Blocked: this recording needs documented internet-radio rights clearance.")
    if track.get("broadcast_use")!="internet_radio":
        raise ValueError("Blocked: the rights scope does not authorize internet radio.")
    return track

def download_public_mp3(url):
    request=urllib.request.Request(url,headers={"User-Agent":"HUMKIN-AzuraCast-Review-Bridge/1.0"})
    with urllib.request.urlopen(request,timeout=30) as response:
        result=bytearray()
        while len(result)<=MAX_BYTES:
            chunk=response.read(min(65536,MAX_BYTES+1-len(result)))
            if not chunk:break
            result.extend(chunk)
        if not 1000<=len(result)<=MAX_BYTES:
            raise ValueError("Source MP3 must be nonempty and below 50 MiB.")
        return bytes(result)

def upload_one(track,host,station,token):
    if not station or not station.isdigit():raise ValueError("AzuraCast station ID must be numeric.")
    url=public_https(host).rstrip("/")+"/api/station/"+station+"/files"
    name="HUMKIN/"+track["id"]+".mp3"
    mp3=download_public_mp3(track["source_url"])
    body=json.dumps({"path":name,"file":base64.b64encode(mp3).decode("ascii")}).encode("utf-8")
    request=urllib.request.Request(url,data=body,method="POST",headers={
      "Authorization":"Bearer "+token,"Content-Type":"application/json",
      "User-Agent":"HUMKIN-AzuraCast-Review-Bridge/1.0"})
    with urllib.request.urlopen(request,timeout=120) as response:
        data=response.read(32768)
        if not 200<=response.status<300:raise RuntimeError("Host did not accept file")
        obj=json.loads(data) if data else {}
        return {"http_status":response.status,"target_path":name,
          "host_message":str(obj.get("message","accepted"))[:150],
          "warning":"Check host media library and schedule manually before any broadcast."}

def main():
    p=argparse.ArgumentParser(description="Review-gated cloud-station audio transfer; never runs automatically")
    p.add_argument("--export-review-manifest",action="store_true",
      help="Print a new manifest of eligible published music, all rights set NEEDS REVIEW")
    p.add_argument("--fixture",type=Path,help="Offline test catalog JSON instead of live public catalog")
    p.add_argument("--manifest",type=Path,help="Previously reviewed station transfer JSON")
    p.add_argument("--upload-id",help="Exact approved recording ID; sends ONLY this track")
    p.add_argument("--confirm-owner-rights",action="store_true",
      help="Explicitly attest to reviewing this recording's broadcast rights")
    args=p.parse_args()
    try:
        if args.export_review_manifest:
            catalog=json.loads(args.fixture.read_text()) if args.fixture else engine.live_catalog()
            print(json.dumps(new_manifest(catalog),indent=2))
            return 0
        if not args.manifest:raise ValueError("Pass --export-review-manifest or --manifest PATH.")
        manifest=json.loads(args.manifest.read_text(encoding="utf-8"))
        if not args.upload_id:
            pending=sum(t.get("rights")!="cleared_for_internet_radio" for t in manifest.get("tracks",[]))
            print(f"Manifest check: {len(manifest.get('tracks',[]))} recordings; {pending} need human rights review.")
            print("No file has been uploaded. Pick one authorized track to test host transfer.")
            return 0
        track=checked_entry(manifest,args.upload_id)
        if not args.confirm_owner_rights:
            raise ValueError("Use --confirm-owner-rights after checking actual media rights and release.")
        host=os.environ.get("AZURACAST_HOST_URL","")
        station=os.environ.get("AZURACAST_STATION_ID","")
        key=os.environ.get("AZURACAST_API_KEY","")
        if not (host and station and key):
            raise ValueError("Missing private AzuraCast host/station/key environment variables.")
        print(json.dumps(upload_one(track,host,station,key),indent=2))
        return 0
    except (OSError,ValueError,RuntimeError,KeyError,TypeError) as e:
        print("TRANSFER BLOCKED: "+str(e),file=sys.stderr)
        return 1
if __name__=="__main__":raise SystemExit(main())
