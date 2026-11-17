#!/usr/bin/env python3
"""Blue Lemon client tests. No external HTTP, no active station, no real keys."""
import importlib.util
import pathlib
import unittest

SOURCE=pathlib.Path("tools/radio-broadcast/blue_lemon.py").resolve()
spec=importlib.util.spec_from_file_location("humkin_blue_lemon",SOURCE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class BlueLemonTests(unittest.TestCase):
    def setUp(self):
        self.catalog={"tracks":[
          {"id":"mutant-pop-01","title":"One","artist":"HUMKIN","kind":"song"},
          {"id":"cart-1","title":"ID","artist":"HUMKIN","kind":"bumper"},
          {"id":"crate-012","title":"Cloud","artist":"HUMKIN","kind":"song"}]}
    def test_requires_real_secret(self):
        worker=mod.BlueLemon(key="")
        self.assertFalse(worker.start(self.catalog))
        self.assertFalse(worker.active)
        self.assertIsNone(worker.take())
    def test_catalog_only_songs_and_clean_shutdown(self):
        worker=mod.BlueLemon(key="A"*48)
        calls=[]
        def fake(action,**body):
            calls.append((action,body))
            if action=="worker_next":
                return {"ok":True,"request":{"id":"receipt-test","track_id":"mutant-pop-01"}}
            return {"ok":True}
        worker.send=fake
        self.assertTrue(worker.start(self.catalog))
        synced=next(payload["tracks"] for action,payload in calls if action=="worker_catalog")
        self.assertEqual([t["id"] for t in synced],["mutant-pop-01","crate-012"])
        self.assertEqual(worker.take()["track_id"],"mutant-pop-01")
        worker.finish("receipt-test",True)
        worker.finish("receipt-test-bad",False)
        self.assertIn(("worker_finish",{"id":"receipt-test","status":"aired"}),calls)
        self.assertIn(("worker_finish",{"id":"receipt-test-bad","status":"failed"}),calls)
        worker.close()
        self.assertIn(("worker_offline",{}),calls)
        self.assertFalse(worker.active)
    def test_denied_catalog_does_not_advertise_online(self):
        worker=mod.BlueLemon(key="B"*48)
        calls=[]
        worker.send=lambda action,**body:(calls.append(action),None)[1]
        self.assertFalse(worker.start(self.catalog))
        self.assertNotIn("worker_heartbeat",calls)
        self.assertFalse(worker.active)

if __name__=="__main__":
    unittest.main()
