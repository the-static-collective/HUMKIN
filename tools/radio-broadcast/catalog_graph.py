"""Audit-first HUMKIN catalog graph. No source audio or cloud catalog writes.

The graph is deliberately separate from playout until a reviewed migration.
Recording IDs are never generated from mutable names. Artist/album relations
are explicit pointers, not assumptions made from matching text.
"""
import json
from contextlib import contextmanager
from pathlib import Path
import sqlite3
import time
import uuid


FIELDS = frozenset(("title", "artist", "album", "genre", "tags", "notes", "artwork"))
FIELD_LIMITS = {"title": 160, "artist": 160, "album": 180, "genre": 100,
                "tags": 400, "notes": 1000, "artwork": 512}
RELATIONS = {
    "artist-credit": ("recording", "artist"),
    "album-track": ("album", "recording"),
    "station-member": ("station", "recording"),
    "release-of": ("release", "album"),
}


class RevisionConflict(ValueError):
    pass


class CatalogGraph:
    """SQLite-backed ledger; one transaction and audit event per graph edit."""

    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._open() as db:
            db.execute("PRAGMA journal_mode = WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS graph_clock (
                    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
                    revision INTEGER NOT NULL DEFAULT 0
                );
                INSERT OR IGNORE INTO graph_clock(singleton, revision) VALUES (1, 0);
                CREATE TABLE IF NOT EXISTS nodes (
                    node_id TEXT PRIMARY KEY, kind TEXT NOT NULL,
                    source TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}'
                );
                CREATE TABLE IF NOT EXISTS edges (
                    src TEXT NOT NULL, predicate TEXT NOT NULL, dst TEXT NOT NULL,
                    PRIMARY KEY (src, predicate, dst),
                    FOREIGN KEY (src) REFERENCES nodes(node_id),
                    FOREIGN KEY (dst) REFERENCES nodes(node_id)
                );
                CREATE TABLE IF NOT EXISTS changes (
                    revision INTEGER PRIMARY KEY, at_ns INTEGER NOT NULL,
                    actor TEXT NOT NULL, operation TEXT NOT NULL,
                    target TEXT NOT NULL, before_json TEXT NOT NULL,
                    after_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS edges_target ON edges(dst, predicate);
            """)

    @contextmanager
    def _open(self):
        db = sqlite3.connect(self.path, timeout=5)
        try:
            db.execute("PRAGMA foreign_keys = ON")
            db.execute("PRAGMA busy_timeout = 5000")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def _id(value):
        if not isinstance(value, str) or not 0 < len(value) <= 256 or value.strip() != value:
            raise ValueError("Use a stable, nonempty entity ID under 257 characters.")
        return value

    @staticmethod
    def _source(source):
        if not isinstance(source, dict):
            raise ValueError("Source must be a JSON object.")
        if len(json.dumps(source)) > 8192:
            raise ValueError("Source evidence is too large.")
        return json.dumps(source, ensure_ascii=False, sort_keys=True)

    def revision(self):
        with self._open() as db:
            return db.execute("SELECT revision FROM graph_clock WHERE singleton=1").fetchone()[0]

    def register(self, kind, node_id, source):
        """Retain first-observed source evidence; a later scrape cannot overwrite it."""
        if kind not in ("recording", "artist", "album", "release", "station"):
            raise ValueError("Unknown node kind.")
        self._id(node_id)
        if not isinstance(source, dict):
            raise ValueError("Source must be a JSON object.")
        if kind == "recording" and source.get("id") != node_id:
            raise ValueError("A recording's stable ID must match its source ID.")
        with self._open() as db:
            existing = db.execute("SELECT kind FROM nodes WHERE node_id=?", (node_id,)).fetchone()
            if existing and existing[0] != kind:
                raise ValueError("Entity ID already belongs to a different kind.")
            if not existing:
                db.execute("INSERT INTO nodes(node_id,kind,source) VALUES (?,?,?)",
                           (node_id, kind, self._source(source)))
        return node_id

    def new_entity(self, kind, label, source=None):
        if kind not in ("artist", "album", "release", "station"):
            raise ValueError("Create recordings using source-issued IDs.")
        if not isinstance(label, str) or not label.strip() or len(label) > 180:
            raise ValueError("Entity needs a label.")
        node_id = kind + ":" + str(uuid.uuid4())
        self.register(kind, node_id, {"label": label.strip(), **(source or {})})
        return node_id

    def get(self, node_id):
        with self._open() as db:
            row = db.execute(
                "SELECT kind,source,metadata FROM nodes WHERE node_id=?", (self._id(node_id),)
            ).fetchone()
        if row is None:
            return None
        return {"id": node_id, "kind": row[0], "source": json.loads(row[1]),
                "metadata": json.loads(row[2])}

    @staticmethod
    def _validate_patch(patch):
        if not isinstance(patch, dict) or not patch or any(k not in FIELDS for k in patch):
            raise ValueError("Unsupported or empty metadata patch.")
        for key, value in patch.items():
            if not isinstance(value, str) or len(value) > FIELD_LIMITS[key]:
                raise ValueError("Invalid metadata field: " + key)
            if key == "title" and not value.strip():
                raise ValueError("A recording must retain a title.")
            if key == "artwork" and value:
                # No arbitrary remote URLs or local file paths are published.
                from now_playing import artwork_url
                if artwork_url(value) != value:
                    raise ValueError("Artwork must use an approved public HTTPS URL.")
        return {key: value.strip() for key, value in patch.items()}

    @staticmethod
    def _actor(actor):
        if not isinstance(actor, str) or not actor or len(actor) > 120:
            raise ValueError("Name an accountable actor.")
        return actor

    def _transact(self, expected_revision, actor, operation, target, apply):
        if not isinstance(expected_revision, int) or isinstance(expected_revision, bool):
            raise RevisionConflict("A numeric graph revision is required.")
        with self._open() as db:
            db.execute("BEGIN IMMEDIATE")
            current = db.execute(
                "SELECT revision FROM graph_clock WHERE singleton=1"
            ).fetchone()[0]
            if current != expected_revision:
                raise RevisionConflict(
                    "Graph changed from revision %s to %s. Refresh and review before saving." %
                    (expected_revision, current))
            before, after = apply(db)
            if before == after:
                return current
            next_revision = current + 1
            db.execute("UPDATE graph_clock SET revision=? WHERE singleton=1", (next_revision,))
            db.execute("""INSERT INTO changes(revision, at_ns, actor, operation, target, before_json, after_json)
                          VALUES (?,?,?,?,?,?,?)""",
                       (next_revision, time.time_ns(), self._actor(actor), operation, target,
                        json.dumps(before, sort_keys=True), json.dumps(after, sort_keys=True)))
            return next_revision

    def edit_recording(self, recording_id, patch, expected_revision, actor="tower"):
        recording_id = self._id(recording_id)
        values = self._validate_patch(patch)
        def apply(db):
            row = db.execute("SELECT kind,metadata FROM nodes WHERE node_id=?",
                             (recording_id,)).fetchone()
            if not row or row[0] != "recording":
                raise ValueError("The recording must be explicitly registered before editing.")
            before = json.loads(row[1])
            after = {**before, **values}
            db.execute("UPDATE nodes SET metadata=? WHERE node_id=?",
                       (json.dumps(after, sort_keys=True), recording_id))
            return before, after
        return self._transact(expected_revision, actor, "recording-metadata", recording_id, apply)

    def link(self, src, predicate, dst, expected_revision, actor="tower"):
        src, dst = self._id(src), self._id(dst)
        if predicate not in RELATIONS:
            raise ValueError("Unknown relationship.")
        def apply(db):
            kinds = []
            for key in (src, dst):
                row = db.execute("SELECT kind FROM nodes WHERE node_id=?", (key,)).fetchone()
                if not row:
                    raise ValueError("Both relationship endpoints must be registered.")
                kinds.append(row[0])
            if tuple(kinds) != RELATIONS[predicate]:
                raise ValueError("Relationship must connect the expected entity kinds.")
            exists = db.execute("SELECT 1 FROM edges WHERE src=? AND predicate=? AND dst=?",
                                (src, predicate, dst)).fetchone()
            if not exists:
                db.execute("INSERT INTO edges(src,predicate,dst) VALUES (?,?,?)", (src, predicate, dst))
            return {"present": bool(exists)}, {"present": True}
        return self._transact(expected_revision, actor, "relationship", json.dumps([src,predicate,dst]), apply)

    def unlink(self, src, predicate, dst, expected_revision, actor="tower"):
        src, dst = self._id(src), self._id(dst)
        if predicate not in RELATIONS:
            raise ValueError("Unknown relationship.")
        def apply(db):
            exists = db.execute("SELECT 1 FROM edges WHERE src=? AND predicate=? AND dst=?",
                                (src,predicate,dst)).fetchone()
            if exists:
                db.execute("DELETE FROM edges WHERE src=? AND predicate=? AND dst=?",
                           (src,predicate,dst))
            return {"present": bool(exists)}, {"present": False}
        return self._transact(expected_revision, actor, "relationship", json.dumps([src,predicate,dst]), apply)

    def undo_latest(self, expected_revision, actor="tower"):
        """Compensating audited transaction; never erases history."""
        self._actor(actor)
        def apply(db):
            row = db.execute(
                "SELECT operation,target,before_json,after_json FROM changes WHERE revision=?",
                (expected_revision,)
            ).fetchone()
            if not row:
                raise ValueError("No recorded change to undo.")
            operation, target, old_raw, new_raw = row
            old, new = json.loads(old_raw), json.loads(new_raw)
            if operation == "recording-metadata":
                result = db.execute("SELECT metadata FROM nodes WHERE node_id=?", (target,)).fetchone()
                if not result or json.loads(result[0]) != new:
                    raise RevisionConflict("Current metadata does not match the audited change.")
                db.execute("UPDATE nodes SET metadata=? WHERE node_id=?",
                           (json.dumps(old, sort_keys=True), target))
            elif operation == "relationship":
                src, predicate, dst = json.loads(target)
                if old["present"]:
                    db.execute("INSERT OR IGNORE INTO edges(src,predicate,dst) VALUES (?,?,?)",
                               (src,predicate,dst))
                else:
                    db.execute("DELETE FROM edges WHERE src=? AND predicate=? AND dst=?",
                               (src,predicate,dst))
            else:
                raise ValueError("The latest change cannot be reversed automatically.")
            return new, old
        return self._transact(expected_revision, actor, "undo", "rev:" + str(expected_revision), apply)

    def snapshot(self):
        """Read-only export for backup, migration preview or future APIs."""
        with self._open() as db:
            rev = db.execute("SELECT revision FROM graph_clock WHERE singleton=1").fetchone()[0]
            nodes = [{"id": nid, "kind": kind, "source": json.loads(source),
                      "metadata": json.loads(metadata)}
                     for nid, kind, source, metadata in db.execute(
                         "SELECT node_id,kind,source,metadata FROM nodes ORDER BY node_id")]
            edges = [{"from": src, "type": pred, "to": dst}
                     for src, pred, dst in db.execute(
                         "SELECT src,predicate,dst FROM edges ORDER BY src,predicate,dst")]
            audit = [{"revision": r, "time_ns": t, "actor": who, "operation": operation,
                      "target": target, "before": json.loads(before), "after": json.loads(after)}
                     for r, t, who, operation, target, before, after in db.execute(
                         "SELECT revision,at_ns,actor,operation,target,before_json,after_json "
                         "FROM changes ORDER BY revision")]
        return {"schema": "humkin.catalog-graph.v1", "revision": rev, "nodes": nodes,
                "edges": edges, "audit": audit}
