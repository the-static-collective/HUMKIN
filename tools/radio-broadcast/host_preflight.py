#!/usr/bin/env python3
"""HUMKIN Radio: verify a hosted HTTPS Icecast/AzuraCast listener endpoint.
This is a READ-ONLY smoke test. It never purchases hosting or publishes tracks.
"""
import argparse
import ipaddress
import json
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request

ALLOWED_CONTENT=("audio/mpeg","audio/mp3","audio/aac","audio/aacp",
                 "audio/ogg","application/ogg","audio/x-mpegurl")
MAX_READ=32768

def public_https(raw):
    parsed=urllib.parse.urlsplit(str(raw))
    if parsed.scheme!="https" or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("Use a public HTTPS URL without credentials.")
    if parsed.fragment:raise ValueError("A stream URL must not contain a fragment.")
    if parsed.hostname in {"localhost","127.0.0.1","::1"}:
        raise ValueError("Local or loopback addresses are not public station URLs.")
    if parsed.hostname:
        try:
            ip=ipaddress.ip_address(parsed.hostname)
        except ValueError:
            if parsed.hostname.endswith((".local",".internal",".test")):
                raise ValueError("Use a public DNS hostname.")
        else:
            if not ip.is_global:raise ValueError("Only publicly reachable hosts are allowed.")
    return parsed.geturl()

def safe_open(url,timeout=9):
    # Explicit redirects are validated too, so private URLs cannot be followed.
    class VerifiedRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,req,fp,code,msg,headers,newurl):
            new=public_https(newurl)
            return super().redirect_request(req,fp,code,msg,headers,new)
    req=urllib.request.Request(url,headers={"User-Agent":"HUMKIN-Live-Source-Preflight/1.0"})
    opener=urllib.request.build_opener(VerifiedRedirect)
    return opener.open(req,timeout=timeout)

def check_nowplaying(url):
    url=public_https(url)
    with safe_open(url) as response:
        if response.status!=200:raise RuntimeError(f"Now playing returned HTTP {response.status}")
        data=response.read(MAX_READ+1)
        if len(data)>MAX_READ:raise RuntimeError("Now-playing response is too large.")
        record=json.loads(data)
    if not isinstance(record,dict) or not isinstance(record.get("station"),dict):
        raise RuntimeError("Unexpected now-playing JSON structure; check AzuraCast shortcode.")
    return {"station":str(record["station"].get("name",""))[:100],
            "is_online":bool(record.get("is_online",False)),
            "now_playing":str((record.get("now_playing") or {}).get("song",{}).get("title",""))[:100]}

def check_stream(url):
    url=public_https(url)
    with safe_open(url) as response:
        content_type=response.headers.get("content-type","").split(";")[0].strip().lower()
        status=response.status
        if status!=200:raise RuntimeError(f"Stream returned HTTP {status}")
        data=response.read(2048)
    if content_type not in ALLOWED_CONTENT:
        raise RuntimeError(f"Listener URL is not identified as supported audio: {content_type or '<missing>'}")
    if len(data)<256:raise RuntimeError("No continuous audio bytes received from listener endpoint.")
    return {"content_type":content_type,"audio_bytes_read":len(data),"http_status":status}

def main():
    p=argparse.ArgumentParser(description="Read-only hosted transmitter preflight; no publication")
    p.add_argument("--stream-url",required=True,help="Public listener URL, NOT private source password URL")
    p.add_argument("--nowplaying-url",help="Optional AzuraCast /api/nowplaying/STATION_SHORTCODE URL")
    args=p.parse_args()
    try:
        stream=public_https(args.stream_url)
        nowplaying=public_https(args.nowplaying_url) if args.nowplaying_url else None
        # A bare Icecast service may not provide an AzuraCast API. Prove the
        # listener's audio bytes regardless; only claim host-reported online
        # state if the optional supported AzuraCast endpoint actually exists.
        sound=check_stream(stream)
        now=check_nowplaying(nowplaying) if nowplaying else None
        if now is not None and not now["is_online"]:
            raise RuntimeError("AzuraCast reports station offline; do not mark a live listener ready.")
        result={"verified_listener":True,"stream_url":stream,
            "stream":sound,"nowplaying_url":nowplaying,"nowplaying":now,
            "status_proof":"azuracast_online" if now is not None else "audio_bytes_only",
            "website_configuration":{
                "live_stream_url":stream,
                "live_nowplaying_url":nowplaying
            },
            "note":("Read-only probe passed. Independently listen on cellular; no site update or broadcast occurred. "+
                    ("Host reports online." if now is not None else
                     "No now-playing service was checked; audio bytes do not establish the source identity or station continuity."))}
        print(json.dumps(result,indent=2))
    except (OSError,ValueError,RuntimeError,urllib.error.URLError,json.JSONDecodeError) as e:
        print("NOT READY: "+str(e),file=sys.stderr)
        return 1
    return 0
if __name__=="__main__":raise SystemExit(main())
