#!/usr/bin/env python3
"""Isolated HUMKIN Blue Lemon queue client. Requires only Python standard library.

The private worker key lives in HUMKIN_BLUE_LEMON_WORKER_KEY on the broadcaster,
not in a public website, listener app, Git repository, or log.
No issued cards are required to test worker connectivity.
"""
import json
import os
import threading
import urllib.error
import urllib.request

ENDPOINT = "https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-blue-lemon"


class BlueLemon:
    def __init__(self, key=None, endpoint=ENDPOINT):
        self.key = key if key is not None else os.environ.get("HUMKIN_BLUE_LEMON_WORKER_KEY", "")
        self.endpoint = endpoint
        self.active = False
        self.stop = threading.Event()
        self.thread = None

    def send(self, action, **payload):
        if not self.key:
            return None
        body = json.dumps({"action": action, **payload}, separators=(",", ":")).encode("utf-8")
        request = urllib.request.Request(self.endpoint, data=body, headers={
            "Content-Type": "application/json",
            "x-humkin-worker-key": self.key,
            "User-Agent": "HUMKIN-Broadcast-Blue-Lemon/0.1",
        }, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=2.5) as reply:
                data = json.load(reply)
                return data if data.get("ok") else None
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError, OSError):
            return None

    def start(self, catalog):
        if not self.key:
            print("BLUE LEMON: no worker key; queue disabled", flush=True)
            return False
        songs = []
        seen = set()
        for track in catalog.get("tracks", []):
            ident = track.get("id")
            if track.get("kind") == "bumper" or ident in seen or not ident:
                continue
            seen.add(ident)
            songs.append({"id": ident,
                          "title": track.get("title", "Untitled"),
                          "artist": track.get("artist", "HUMKIN")})
        if not songs or not self.send("worker_catalog", tracks=songs):
            print("BLUE LEMON: catalog synchronization unavailable; queue disabled", flush=True)
            return False
        if not self.send("worker_heartbeat"):
            print("BLUE LEMON: worker not authorized/reachable; queue disabled", flush=True)
            return False
        self.active = True
        self.stop.clear()
        self.thread = threading.Thread(target=self._pulse, daemon=True)
        self.thread.start()
        print("BLUE LEMON: worker connected; waiting for actual station requests", flush=True)
        return True

    def _pulse(self):
        while not self.stop.wait(55):
            if not self.send("worker_heartbeat"):
                print("BLUE LEMON: temporary heartbeat outage; playout continues", flush=True)

    def take(self):
        # Only called from the music boundary, never inside an active show or bumper.
        if not self.active:
            return None
        response = self.send("worker_next")
        return response.get("request") if response else None

    def finish(self, request_id, succeeded):
        if self.active and request_id:
            if not self.send("worker_finish", id=request_id,
                             status="aired" if succeeded else "failed"):
                print("BLUE LEMON: couldn't confirm selection receipt", flush=True)

    def close(self):
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=0.2)
        if self.active:
            self.send("worker_offline")
            self.active = False
