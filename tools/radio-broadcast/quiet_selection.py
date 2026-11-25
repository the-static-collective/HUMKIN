#!/usr/bin/env python3
"""Prepare a reviewed Quiet Frequency selection. No R2 writes, no auto-picks."""
import argparse
import json
from pathlib import Path
from house_rotation import catalog_rows, make_quiet_selection, validate_selection

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", type=Path, required=True, help="JSON array of approved R2 catalog IDs in owner order")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    ids = json.loads(args.ids.read_text(encoding="utf-8"))
    rows = catalog_rows()
    packet = make_quiet_selection(rows, ids)
    validate_selection(packet, rows)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(packet, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    print("REVIEW ONLY:", len(packet["tracks"]), "tracks;", round(sum(t["duration_seconds"] for t in packet["tracks"])/3600, 2), "hours")
    print("Fingerprint:", packet["fingerprint"])

if __name__ == "__main__":
    main()
