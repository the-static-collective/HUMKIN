#!/usr/bin/env python3
"""Offline transmitter smoke-test acceptance without a hosted station."""
import importlib.util
import io
import sys
from contextlib import redirect_stdout, redirect_stderr
import json
import unittest
from pathlib import Path
from unittest.mock import patch

source=Path("tools/radio-broadcast/host_preflight.py").resolve()
spec=importlib.util.spec_from_file_location("radio_host_preflight",source)
host=importlib.util.module_from_spec(spec);spec.loader.exec_module(host)

class Response:
    def __init__(self,data,content_type="application/json"):
        self.data=data
        self.status=200
        self.headers={"content-type":content_type}
    def read(self,n):
        data=self.data[:n];self.data=self.data[n:];return data
    def __enter__(self):return self
    def __exit__(self,*args):return False

class Tests(unittest.TestCase):
    def test_hosted_https_only(self):
        self.assertEqual(host.public_https("https://radio.example.org/listen.mp3"),
                         "https://radio.example.org/listen.mp3")
        for url in ("http://radio.example.org/listen.mp3",
                    "https://127.0.0.1/live.mp3","https://10.0.0.12/live.mp3",
                    "https://localhost/live.mp3","https://operator:password@radio.example.org/live.mp3",
                    "file:///private/audio.mp3","javascript:alert(1)"):
            with self.assertRaises(ValueError):host.public_https(url)
    def test_stream_proof_needs_audio_bytes(self):
        with patch.object(host,"safe_open",return_value=Response(b"ID3"+b"\x01"*2048,"audio/mpeg")):
            proof=host.check_stream("https://radio.example.org/listen.mp3")
        self.assertEqual(proof["http_status"],200)
        self.assertTrue(proof["audio_bytes_read"]>=256)
        with patch.object(host,"safe_open",return_value=Response(b"<html>bad</html>","text/html")):
            with self.assertRaises(RuntimeError):host.check_stream("https://radio.example.org/listen.mp3")
    def test_bare_icecast_https_probe_without_azuracast(self):
        args=["host_preflight.py","--stream-url","https://radio.example.org/humkin.mp3"]
        with patch.object(sys,"argv",args), patch.object(host,"check_stream",return_value={
             "content_type":"audio/mpeg","http_status":200,"audio_bytes_read":2048
             }) as verify, redirect_stdout(io.StringIO()) as out:
            self.assertEqual(host.main(),0)
        record=json.loads(out.getvalue())
        self.assertTrue(record["verified_listener"])
        self.assertEqual(record["status_proof"],"audio_bytes_only")
        self.assertIsNone(record["website_configuration"]["live_nowplaying_url"])
        verify.assert_called_once_with("https://radio.example.org/humkin.mp3")

    def test_azuracast_endpoint_remains_optional_but_enforced(self):
        args=["host_preflight.py","--stream-url","https://radio.example.org/humkin.mp3",
              "--nowplaying-url","https://radio.example.org/api/nowplaying/humkin"]
        with patch.object(sys,"argv",args), patch.object(host,"check_stream",return_value={
             "content_type":"audio/mpeg","http_status":200,"audio_bytes_read":2048
             }), patch.object(host,"check_nowplaying",return_value={
             "station":"HUMKIN","is_online":False,"now_playing":"None"
             }), redirect_stderr(io.StringIO()) as err:
            self.assertEqual(host.main(),1)
        self.assertIn("offline",err.getvalue())

    def test_now_playing_requires_real_api(self):
        sample={"station":{"name":"HUMKIN RADIO"},"is_online":True,
                "now_playing":{"song":{"title":"HaileyLu Bloom"}}}
        with patch.object(host,"safe_open",return_value=Response(json.dumps(sample).encode())):
            status=host.check_nowplaying("https://radio.example.org/api/nowplaying/humkin")
        self.assertTrue(status["is_online"]);self.assertEqual(status["station"],"HUMKIN RADIO")
        with patch.object(host,"safe_open",return_value=Response(b"{}")):
            with self.assertRaises(RuntimeError):
                host.check_nowplaying("https://radio.example.org/api/nowplaying/humkin")
if __name__=="__main__":
    unittest.main()
