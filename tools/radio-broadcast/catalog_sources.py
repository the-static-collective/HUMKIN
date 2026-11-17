"""Only public, editorially approved extra media enters Station One."""
import re
from urllib.parse import quote, urljoin, urlsplit


def optional_catalog(get_json, radio, api):
    tracks, chart_ids = [], []

    # The published field-carts manifest is an explicit allowlist.
    try:
        data = get_json(radio + "air-carts.json")
        carts = data.get("carts", [])
        if data.get("schema_version") == "humkin.radio.air-carts/v1" and isinstance(carts, list) and len(carts) <= 16:
            seen = set()
            for row in carts:
                id_ = str(row.get("id", ""))
                url = urljoin(radio, str(row.get("src", "")))
                parsed = urlsplit(url)
                try: duration = float(row.get("duration_seconds", 0))
                except (ValueError, TypeError): continue
                if not (re.fullmatch(r"field-fm-[0-9]{3}", id_)
                        and re.fullmatch(r"[0-9a-f]{64}", str(row.get("sha256", "")))
                        and re.fullmatch(r"/fm/studio/recordings/[a-z0-9-]+\.mp3", parsed.path)
                        and parsed.scheme == "https" and parsed.netloc == "humkin.abundent.org"
                        and not parsed.query and not parsed.fragment and 1 < duration <= 120
                        and id_ not in seen and str(row.get("title", "")).strip()):
                    continue
                seen.add(id_)
                tracks.append(dict(id="air-"+id_, title=str(row["title"])[:180],
                    artist="HUMKIN", album="HUMKIN RADIO · STATION BUMPERS",
                    kind="bumper", duration=duration, source="static", url=url))
    except (OSError, ValueError, TypeError, KeyError):
        pass

    # Only public R2 records carrying approved:true in a published manifest.
    try:
        data = get_json(radio + "r2-tracks.json")
        rows = data.get("tracks", [])
        if data.get("schema") == "humkin.radio.r2/v1" and isinstance(rows, list) and len(rows) <= 2000:
            seen = set()
            for row in rows:
                if row.get("approved") is not True: continue
                bare = str(row.get("id", ""))
                key = row.get("object_key")
                if not isinstance(key, str): continue
                parts = key.split("/")
                try: duration = float(row.get("duration_seconds", 0))
                except (ValueError, TypeError): continue
                if not (re.fullmatch(r"[a-z0-9][a-z0-9-]{2,79}",bare)
                        and len(key) <= 400 and key.endswith(".mp3")
                        and all(part not in ("", ".", "..") and
                            not re.search(r"[\\?#\x00-\x1f\x7f]", part) for part in parts)
                        and 0 < duration < 14400 and bare not in seen
                        and str(row.get("title", "")).strip()):
                    continue
                seen.add(bare)
                tracks.append(dict(id="r2-"+bare,title=str(row["title"]).strip()[:240],
                    artist=str(row.get("artist") or "HUMKIN")[:160],
                    album=str(row.get("album") or "HUMKIN RADIO · R2")[:200],
                    kind="song",duration=duration,source="r2",
                    seasonal=row.get("seasonal") is True,
                    url="https://media.abundent.org/"+"/".join(quote(p,safe="") for p in parts)))
    except (OSError, ValueError, TypeError, KeyError):
        pass

    # Chart is read only; an outage means no unearned chart play.
    try:
        chart = get_json(api + "/functions/v1/humkin-league")
        if chart.get("schema") == "humkin.top42/v1":
            chart_ids = [str(row["id"]) for row in chart.get("airchart", [])
                         if isinstance(row, dict) and isinstance(row.get("id"), str)
                         and float(row.get("plays") or 0)>0]
    except (OSError, ValueError, TypeError, KeyError):
        pass
    return tracks, chart_ids
