"""Private Acer control surface for the StationV2 scheduler."""
import json
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

from now_playing import artwork_url, write_json
from archive_catalog import archive_snapshot


class Desk:
    def __init__(self, station, path, preview=False, tower=None):
        self.station = station
        self.path = Path(path)
        self.preview = preview
        self.tower = tower
        self.lock = threading.RLock()
        self.session = secrets.token_hex(12)
        self.revision = 0
        self.current = None
        self.play = 0
        self.started = 0
        self.skip = False
        self.ready = None
        self.failed = set()
        self.move = None
        self.state = {"tracks": {}, "history": []}
        if path.exists():
            self.state = json.loads(path.read_text(encoding="utf-8"))
        self.state.setdefault("lineup", [])
        self.state.setdefault("metadata", {})
        self.on_metadata_change = None
        self.default_catalog = station.catalog
        self.default_songs = station.songs[:]
        self.catalog_revision = 0
        if self.tower:
            self.tower.find_tracks(station.by_id)
            station.songs.extend(id_ for id_ in self.state.get("rotation_uploads", [])
                                 if id_ in station.by_id and id_ not in station.songs)
        self.apply_metadata()
        station.eligible = self.eligible
        station.weight = lambda id_: self.state["tracks"].get(id_, {}).get("weight", 0)
        if self.curated:
            if not any(id_ in self.station.by_id and self.eligible(id_)
                       for id_ in self.state.get("curated_lineup", [])):
                self.state["curated"] = False
            else:
                self.apply_rotation()

    @property
    def can_curate(self):
        return self.tower is not None and self.tower.frequency != "station-one"

    @property
    def curated(self):
        return self.can_curate and self.state.get("curated", False)

    def apply_rotation(self):
        if self.curated:
            self.station.songs = [id_ for id_ in self.state.get("curated_lineup", [])
                                  if id_ in self.station.by_id]
            self.station.catalog = self.default_catalog | {"shows": [], "settings": {}}
            self.station.show_id = None
        else:
            self.station.songs = self.default_songs + [
                id_ for id_ in self.state.get("rotation_uploads", [])
                if id_ in self.station.by_id and id_ not in self.default_songs
            ]
            self.station.catalog = self.default_catalog
        self.station.queue.clear()
        self.move = None

    def edit_archive_lineup(self, action, id_):
        if not self.can_curate:
            raise ValueError("Choose a secondary frequency for a curated lineup.")
        lineup = self.state.get("curated_lineup", [])[:]
        enabled = self.curated
        if action == "lineup_enable":
            enabled = not enabled
        else:
            if not isinstance(id_, str) or id_ not in self.station.by_id:
                raise ValueError("This recording is unavailable.")
            if action == "lineup_add" and id_ not in lineup:
                lineup.append(id_)
            if action == "lineup_remove" and id_ in lineup:
                lineup.remove(id_)
        if enabled and not any(id_ in self.station.by_id and self.eligible(id_) for id_ in lineup):
            raise ValueError("Keep at least one playable recording in the curated lineup.")
        self.save(self.state | {"curated_lineup": lineup, "curated": enabled})
        if enabled or action == "lineup_enable":
            self.apply_rotation()
        self.changed()
        if action == "lineup_enable":
            return "Curated rotation enabled." if enabled else "Standard rotation enabled."
        return "Added to the lineup." if action == "lineup_add" else "Removed from the lineup."

    def refresh_archive(self):
        tracks, scores = archive_snapshot()
        with self.lock:
            added = set()
            for track in tracks:
                if track["id"] not in self.station.by_id:
                    self.station.by_id[track["id"]] = track
                    added.add(track["id"])
            if added:
                self.apply_metadata()
                self.catalog_revision += 1
                if self.curated and added.intersection(self.state.get("curated_lineup", [])):
                    self.apply_rotation()
                self.changed()
        return {"ids": [track["id"] for track in tracks], "scores": scores}

    def apply_metadata(self, id_=None):
        """Overlay non-destructive, frequency-specific metadata on source records."""
        overrides = self.state.get("metadata", {})
        ids = [id_] if id_ is not None else list(overrides)
        for key in ids:
            if key in self.station.by_id and isinstance(overrides.get(key), dict):
                self.station.by_id[key].update(overrides[key])
                if overrides[key].get("artwork"):
                    self.station.by_id[key].pop("local_art", None)

    def edit_metadata(self, id_, values):
        if not isinstance(id_, str) or id_ not in self.station.by_id:
            raise ValueError("That recording is unavailable.")
        if not isinstance(values, dict) or not values:
            raise ValueError("Supply the metadata fields to change.")
        limits = {"title": 160, "artist": 160, "album": 180, "genre": 100,
                  "tags": 400, "notes": 1000, "artwork": 512}
        if any(key not in limits for key in values):
            raise ValueError("An unsupported metadata field was supplied.")
        for key, value in values.items():
            if not isinstance(value, str) or len(value) > limits[key]:
                raise ValueError(f"Invalid {key} metadata.")
            if key == "title" and not value.strip():
                raise ValueError("A recording needs a title.")
            if key == "artwork" and value and artwork_url(value) != value:
                raise ValueError("Artwork must use an approved HTTPS media host.")
        saved = self.state.get("metadata", {}).copy()
        saved[id_] = {**saved.get(id_, {}), **{key: value.strip() for key, value in values.items()}}
        self.save(self.state | {"metadata": saved})
        self.apply_metadata(id_)
        self.changed()
        if self.current and self.current["id"] == id_ and self.on_metadata_change:
            self.on_metadata_change(self.current)
        return "Metadata saved for this frequency."

    def eligible(self, id_):
        policy = self.state["tracks"].get(id_, {})
        return (id_ not in self.failed and not policy.get("disabled")
                and policy.get("hold_until", 0) <= time.time())

    def save(self, state):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        write_json(self.path, state)
        self.state = state
        self.catalog_revision += 1

    def changed(self):
        self.revision += 1

    def pending(self, limit=6):
        with self.lock:
            queued = [(("manual", 0, index), id_) for index, id_ in enumerate(self.state["lineup"])
                      if id_ in self.station.by_id and self.eligible(id_)]
            if len(queued) >= limit:
                return queued[:limit]
            return queued + self.station.pending(limit=limit - len(queued))

    def start(self, slot):
        """Commit only if the prepared successor is still the scheduler's choice."""
        with self.lock:
            if self.pending(1) != [slot]:
                return False
            key, id_ = slot
            if key[0] == "manual":
                lineup = self.state["lineup"][:]
                del lineup[key[2]]
                updated = self.state | {"lineup": lineup}
                try:
                    self.save(updated)
                except OSError:
                    # A disk error must not make the encoder dead-air while playing.
                    self.state = updated
                self.current = self.station.by_id[id_]
            else:
                self.current = self.station.take(slot)
            self.play += 1
            self.started = time.monotonic()
            self.skip = False
            self.changed()
            return True

    def fail(self, id_):
        with self.lock:
            self.failed.add(id_)
            if self.curated and not any(self.eligible(song) for song in self.station.songs):
                self.state = self.state | {"curated": False}
                self.apply_rotation()
                self.catalog_revision += 1
            self.changed()

    def track(self, id_):
        item = self.station.by_id[id_]
        policy = self.state["tracks"].get(id_, {})
        return {key: item.get(key) for key in ("id", "title", "artist", "duration", "kind")} | {
            "weight": policy.get("weight", 0),
            "rotation": id_ in self.station.songs,
            "uploaded": item.get("source") == "upload",
            "in_lineup": id_ in self.state.get("curated_lineup", []),
            "album": item.get("album", ""),
            "genre": item.get("genre", ""),
            "tags": item.get("tags", ""),
            "notes": item.get("notes", ""),
            "artwork": item.get("artwork", ""),
            "disabled": bool(policy.get("disabled")),
            "held": policy.get("hold_until", 0) > time.time(),
        }

    def token(self, slot):
        return json.dumps([self.session, self.revision, slot], separators=(",", ":"))

    def queue_undo(self):
        move = self.move
        queue = self.station.queue
        if (move and move["cycle"] == self.station.cycle_no and queue and queue[-1] == move["id"]
                and (not self.state["history"] or move["at"] > self.state["history"][-1].get("at", 0))):
            return move
        return None

    def summary(self):
        with self.lock:
            return {"current": self.track(self.current["id"]) if self.current else None}

    def view(self, catalog_version=None):
        with self.lock:
            if self.tower:
                size = len(self.station.by_id)
                self.tower.find_tracks(self.station.by_id)
                if len(self.station.by_id) != size:
                    self.apply_metadata()
                    self.catalog_revision += 1
            pending = self.pending(4000) if self.tower else self.pending()
            move = self.queue_undo()
            version = f"{self.session}-{self.catalog_revision}"
            return {
                "preview": self.preview,
                "catalog_version": version,
                "can_curate": self.can_curate,
                "curated": self.curated,
                "frequency": self.tower.frequency if self.tower else "station-one",
                "tower": self.tower is not None,
                "current": self.track(self.current["id"]) if self.current else None,
                "elapsed": round(time.monotonic() - self.started) if self.current else 0,
                "play": f"{self.session}/{self.play}",
                "can_skip": bool(self.current and pending and self.ready == pending[0][1] and not self.skip),
                "skip_pending": self.skip,
                "queue": [self.track(id_) | {"slot": self.token((key, id_)), "lane": key[0],
                              "movable": key[0] == "rotation" and key[2] < len(self.station.queue) - 1}
                          for key, id_ in pending],
                **({"catalog": [self.track(id_) for id_ in self.station.by_id]} if version != catalog_version else {}),
                "undo": (move["label"] if move else
                         self.state["history"][-1]["label"] if self.state["history"] else None),
            }

    def act(self, request):
        with self.lock:
            action = request.get("action")
            if action in ("lineup_add", "lineup_remove", "lineup_enable"):
                return self.edit_archive_lineup(action, request.get("id"))
            if action == "metadata_edit":
                return self.edit_metadata(request.get("id"), request.get("metadata"))
            if action == "skip":
                view = self.view()
                if request.get("play") != view["play"] or not view["can_skip"]:
                    raise ValueError("Skip unavailable. Check Now playing and try again.")
                self.skip = True
                return "Skip requested."
            if action == "move":
                return self.move_slot(request.get("slot"))
            if action == "rotation_upload" and self.tower and not self.curated:
                return self.change_rotation(request.get("id"))
            if action in ("queue_next", "queue_end", "reorder", "remove", "use_show_order"):
                return self.program(action, request)
            move = self.queue_undo() if action == "undo" else None
            if move:
                queue = self.station.queue
                consumed = move["length"] - len(queue)
                queue.insert(max(0, move["index"] - consumed), queue.pop())
                self.move = None
                self.changed()
                return "Queue move undone."
            tracks = self.state["tracks"].copy()
            history = self.state["history"][:]
            if action == "undo":
                if not history:
                    raise ValueError("There is no programming change to undo.")
                change = history.pop()
                id_, after = change["id"], change["before"]
                message = f'Undid {change["label"]}.'
            else:
                id_ = request.get("id")
                if not isinstance(id_, str) or id_ not in self.station.by_id:
                    raise ValueError("That track is unavailable.")
                before = tracks.get(id_, {})
                after = before.copy()
                title = self.station.by_id[id_]["title"]
                if action == "disable":
                    after["disabled"] = not before.get("disabled")
                    label = "Disable" if after["disabled"] else "Enable"
                elif action == "hold":
                    after["hold_until"] = 0 if before.get("hold_until", 0) > time.time() else time.time()+3600
                    label = "Hold for one hour" if after["hold_until"] else "Release hold"
                elif action in ("less", "more") and id_ in self.station.songs:
                    step = before.get("weight", 0) + (1 if action == "more" else -1)
                    if not -2 <= step <= 2:
                        raise ValueError("Rotation weight is already at its limit.")
                    after["weight"] = step
                    label = "Increase rotation weight" if action == "more" else "Decrease rotation weight"
                else:
                    raise ValueError("That action is unavailable for this track.")
                history.append({"id": id_, "before": before, "label": f"{label} · {title}",
                                "at": time.time_ns()})
                message = f"{label} · {title}."
            tracks[id_] = after
            if not any(not tracks.get(song, {}).get("disabled")
                       and tracks.get(song, {}).get("hold_until", 0) <= time.time()
                       for song in self.station.songs if song not in self.failed):
                raise ValueError("At least one playable song must stay in rotation.")
            self.save(self.state | {"tracks": tracks, "history": history[-30:]})
            self.changed()
            return message

    def change_rotation(self, id_):
        item = self.station.by_id.get(id_) if isinstance(id_, str) else None
        if not item or item.get("source") != "upload":
            raise ValueError("Only uploaded tracks can be added to rotation here.")
        songs = self.station.songs
        uploads = set(self.state.get("rotation_uploads", []))
        if id_ in songs:
            if self.eligible(id_) and not any(self.eligible(song) for song in songs if song != id_):
                raise ValueError("At least one playable song must stay in rotation.")
            uploads.discard(id_)
            self.save(self.state | {"rotation_uploads": sorted(uploads)})
            songs.remove(id_)
            self.station.queue = type(self.station.queue)(song for song in self.station.queue if song != id_)
            message = "Removed from automatic rotation."
        else:
            uploads.add(id_)
            self.save(self.state | {"rotation_uploads": sorted(uploads)})
            songs.append(id_)
            message = "Added to the next automatic rotation cycle."
        self.move = None
        self.changed()
        return message

    def program(self, action, request):
        lineup = self.state["lineup"][:]
        if action in ("queue_next", "queue_end"):
            if self.tower:
                self.tower.find_tracks(self.station.by_id)
            id_ = request.get("id")
            if not isinstance(id_, str) or id_ not in self.station.by_id or not self.eligible(id_):
                raise ValueError("This track is unavailable or held on this frequency.")
            if len(lineup) >= 4000:
                raise ValueError("The queue has 4,000 items.")
            lineup.insert(0 if action == "queue_next" else len(lineup), id_)
        else:
            slot_token = request.get("slot")
            destination = request.get("target")
            if not isinstance(slot_token, str) or (destination is not None and not isinstance(destination, str)):
                raise ValueError("Choose a valid queue slot.")
            slots = {self.token(slot): slot for slot in self.pending(4000)}
            slot = slots.get(slot_token)
            target = slots.get(destination)
            if not slot:
                raise ValueError("The queue has advanced. Try again on the updated queue.")
            lane, _, index = slot[0]
            if action == "use_show_order" and lane == "show":
                lineup.extend(item for key, item in slots.values() if key[0] == "show")
            elif action == "remove" and lane == "manual":
                del lineup[index]
            elif action == "reorder" and target and lane == target[0][0] and lane in ("manual", "rotation"):
                destination = target[0][2]
                if lane == "rotation":
                    queue = self.station.queue
                    id_ = queue[index]
                    del queue[index]
                    queue.insert(destination, id_)
                    self.move = None
                    self.changed()
                    return "Rotation reordered."
                lineup.insert(destination, lineup.pop(index))
            else:
                raise ValueError("Move tracks within the same queue.")
            if len(lineup) > 4000:
                raise ValueError("The queue has reached 4,000 items.")
        self.save(self.state | {"lineup": lineup})
        self.changed()
        return "Playlist updated."

    def upload(self, name, size, body):
        track = self.tower.import_track(name, size, body)
        with self.lock:
            self.station.by_id[track["id"]] = track
            if track["id"] in self.state["lineup"]:
                return f'{track["title"]} is already queued.'
            self.program("queue_end", {"id": track["id"]})
        return f'Queued {track["title"]}.'

    def move_slot(self, token):
        for slot in self.pending(4000):
            key, id_ = slot
            if self.token(slot) != token or key[0] != "rotation":
                continue
            queue = self.station.queue
            index = key[2]
            if index == len(queue) - 1:
                raise ValueError("This track is already at the end of rotation.")
            self.move = {"label": f'Move to end · {self.station.by_id[id_]["title"]}',
                         "id": id_, "cycle": self.station.cycle_no, "index": index,
                         "length": len(queue), "at": time.time_ns()}
            del queue[index]
            queue.append(id_)
            self.changed()
            return "Moved to the end of this rotation cycle."
        raise ValueError("The queue has advanced. Try again on the updated queue.")


def serve(desk, port):
    secret = secrets.token_urlsafe(32)
    assets = Path(__file__).parent
    page = (assets / "on_air.html").read_bytes().replace(b"__CONTROL_TOKEN__", secret.encode())
    script = (assets / "on_air.js").read_bytes()
    css = (assets / "on_air.css").read_bytes()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def respond(self, status, content, data):
            self.send_response(status)
            self.send_header("Content-Type", content)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy",
                             "default-src 'none'; script-src 'self'; style-src 'self'; "
                             "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
            self.send_header("X-Content-Type-Options", "nosniff")
            try:
                self.end_headers()
                self.wfile.write(data)
            except ConnectionError:
                # An operator may close a tab while a file finishes importing.
                pass

        def result(self, status, data):
            self.respond(status, "application/json", json.dumps(data).encode())

        def valid_host(self):
            return self.headers.get("Host") == authority

        def authorized(self):
            return self.valid_host() and self.headers.get("X-Station-Control") == secret

        def do_GET(self):
            if not self.valid_host():
                self.send_error(403)
                return
            resources = {"/": ("text/html; charset=utf-8", page),
                         "/on_air.js": ("text/javascript; charset=utf-8", script),
                         "/on_air.css": ("text/css; charset=utf-8", css)}
            if self.path in resources:
                self.respond(200, *resources[self.path])
            elif (self.path == "/state" or self.path.startswith("/state?version=")) and self.authorized():
                self.result(200, desk.view(self.path.partition("?version=")[2]))
            elif self.path == "/archive" and self.authorized() and desk.tower:
                try:
                    self.result(200, desk.refresh_archive())
                except (OSError, ValueError, KeyError):
                    self.result(503, {"message": "The Living Archive could not be refreshed."})
            elif self.path == "/state?summary=1" and self.authorized():
                self.result(200, desk.summary())
            elif self.path == "/frequencies" and self.authorized() and desk.tower:
                self.result(200, desk.tower.frequencies())
            else:
                self.send_error(404)

        def do_POST(self):
            if (self.path not in ("/action", "/upload") or not self.authorized()
                    or self.headers.get("Origin") != "http://" + authority):
                self.send_error(403)
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if self.path == "/upload" and desk.tower:
                    self.connection.settimeout(45)
                    name = unquote(self.headers.get("X-Upload-Name", "")[:4096])
                    message = desk.upload(name, size, self.rfile)
                    self.result(200, {"message": message})
                    return
                if self.path != "/action" or not 0 < size <= 4096:
                    raise ValueError("Invalid control request.")
                self.connection.settimeout(3)
                request = json.loads(self.rfile.read(size))
                if not isinstance(request, dict):
                    raise ValueError("Invalid control request.")
                action = request.get("action")
                if action in ("route", "route_lineup") and desk.tower:
                    message = desk.tower.route(request.get("frequency"), request.get("id"), action == "route_lineup")
                else:
                    id_ = request.get("id")
                    if (action in ("lineup_add", "queue_end") and desk.tower and isinstance(id_, str)
                            and id_ not in desk.station.by_id and not id_.startswith("upload-")):
                        desk.refresh_archive()
                    message = desk.act(request)
                self.result(200, {"message": message, "state": desk.view()})
            except ValueError as exc:
                self.result(409, {"message": str(exc), "state": desk.view()})
            except OSError:
                self.result(503, {"message": "The station could not save this change."})

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    authority = f"127.0.0.1:{server.server_port}"
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    if desk.tower:
        try:
            desk.tower.register(server.server_port, secret)
        except OSError:
            server.shutdown()
            server.server_close()
            raise
        server.unregister_desk = lambda: desk.tower.unregister(secret)
    return server, "http://" + authority
