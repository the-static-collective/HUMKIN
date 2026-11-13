#!/usr/bin/env python3
"""Build HUMKIN's zero-dependency DJ download crate from the verified local album.

The GitHub Pages deploy step executes this on the checked-out main branch.
The generated ZIP and metadata files need not be stored in git.
"""
from __future__ import annotations

import csv
import io
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SONGS = ROOT / "tracks.json"
ZIP = ROOT / "dj-pack.zip"
CSV = ROOT / "dj-crate.csv"
PLAYLIST = ROOT / "dj-crate.m3u8"

def main() -> None:
    album = json.loads(SONGS.read_text(encoding="utf-8"))
    if album.get("artist") != "HUMKIN" or album.get("album") != "MUTANT POP":
        raise ValueError("Unexpected artist/album in tracks.json")
    tracks = album.get("tracks")
    if not isinstance(tracks, list) or len(tracks) != 12:
        raise ValueError("The initial DJ crate must contain all 12 MUTANT POP tracks")

    seen = set()
    for expected, track in enumerate(tracks, 1):
        if track.get("number") != expected:
            raise ValueError("Unexpected or out-of-order track number")
        name = track.get("filename", "")
        url = track.get("url", "")
        if not name.endswith(".mp3") or "/" in name or "\\" in name or url != f"audio/{name}":
            raise ValueError("Unexpected or unsafe MP3 location")
        if name in seen:
            raise ValueError("Duplicate MP3 filename")
        seen.add(name)
        if not (ROOT / url).is_file():
            raise FileNotFoundError(f"Missing official HUMKIN MP3: {url}")

    headers = ["number", "artist", "title", "album", "duration_seconds", "filename", "bpm", "musical_key", "file_format", "lossless_master_published", "stems_published", "source_url"]
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(headers)
    for t in tracks:
        writer.writerow([t["number"], "HUMKIN", t["title"], "MUTANT POP", t["duration"], t["filename"], "", "", "MP3", "NO", "NO", t["source"]])
    csv_bytes = output.getvalue().encode("utf-8-sig")

    m3u = ["#EXTM3U"]
    for t in tracks:
        m3u.append(f'#EXTINF:{int(t["duration"])},HUMKIN - {t["title"]}')
        m3u.append(t["url"])
    m3u_bytes = ("\n".join(m3u) + "\n").encode("utf-8")

    license_text = (ROOT / "docs" / "DJ-PERMISSION.md").read_bytes()
    readme = (
        "HUMKIN — MUTANT POP / DJ STARTER CRATE\n"
        "--------------------------------------\n"
        "Twelve MP3s plus a CSV tracklist and local M3U8 playlist.\n"
        "Extract the entire ZIP and import the audio/*.mp3 files into your DJ app.\n"
        "BPM, key, and individual WAV/stem files are not yet supplied.\n"
        "For permissions and venue licensing, read DJ-PERMISSION.md first.\n"
        "Request WAV or stems: us@abundent.org\n"
        "https://humkin.abundent.org/dj.html\n"
    ).encode("utf-8")

    CSV.write_bytes(csv_bytes)
    PLAYLIST.write_bytes(m3u_bytes)

    # MP3s are already compressed; storing is fast and avoids destructive re-encoding.
    # Consistent member timestamps make generated pack contents easy to compare.
    with zipfile.ZipFile(ZIP, "w", allowZip64=True) as z:
        for t in tracks:
            member = zipfile.ZipInfo(t["url"], date_time=(2026, 11, 13, 0, 0, 0))
            member.compress_type = zipfile.ZIP_STORED
            z.writestr(member, (ROOT / t["url"]).read_bytes())
        extras = {
            "HUMKIN_DJ_README.txt": readme,
            "DJ-PERMISSION.md": license_text,
            "dj-crate.csv": csv_bytes,
            "dj-crate.m3u8": m3u_bytes,
        }
        for name, data in extras.items():
            member = zipfile.ZipInfo(name, date_time=(2026, 11, 13, 0, 0, 0))
            member.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(member, data)

    with zipfile.ZipFile(ZIP) as z:
        assert z.testzip() is None, "ZIP integrity failure"
        assert len([n for n in z.namelist() if n.endswith(".mp3")]) == 12
        assert z.read("dj-crate.csv") == csv_bytes
        assert z.read("DJ-PERMISSION.md") == license_text
    print(f"DJ crate prepared: {ZIP.name} ({ZIP.stat().st_size:,} bytes), 12 actual MP3s, metadata, playlist, and permission")

if __name__ == "__main__":
    main()
