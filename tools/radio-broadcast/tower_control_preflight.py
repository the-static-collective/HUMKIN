"""Cheap no-credential check before paying for a five-minute GitHub runner.

This only decides whether expensive R2/FFmpeg work may be needed. The protected
publisher *always* repeats full owner, catalog and source checks before writes.
"""
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from house_rotation import API, PUBLIC_KEY
CLOUD = "https://humkin-long-wave.joyvolcanomusic.workers.dev/autopilot/station-one/schedule"


def latest_intent(opener=urlopen):
    query = urlencode({"select": "id", "order": "id.desc", "limit": "1"})
    request = Request(API + "/rest/v1/humkin_tower_control_intents?" + query,
                      headers={"apikey": PUBLIC_KEY, "Accept": "application/json"})
    with opener(request, timeout=15) as response:
        if getattr(response, "status", 200) != 200:
            raise ValueError("Control ledger unavailable.")
        data = response.read(2001)
    if len(data) > 2000:
        raise ValueError("Unexpected oversized control ledger response.")
    rows = json.loads(data)
    if not isinstance(rows, list) or len(rows) > 1:
        raise ValueError("Malformed cloud control ledger.")
    if not rows:
        return 0
    value = rows[0].get("id")
    if type(value) is not int or value < 1:
        raise ValueError("Malformed control id.")
    return value


def advertised_cursor(opener=urlopen):
    request = Request(CLOUD, headers={"Accept": "application/json"})
    try:
        with opener(request, timeout=15) as response:
            if getattr(response, "status", 200) != 200:
                return 0
            body = response.read(32001)
    except (HTTPError, URLError, TimeoutError):
        return 0  # Cannot prove no work; the protected publisher will recheck.
    if len(body) > 32000:
        raise ValueError("Cloud control status too large.")
    value = json.loads(body)
    cursors = (value.get("control") or {})
    if value.get("schema") != "humkin.autopilot.public-schedule/v1":
        return 0
    candidates = [cursors.get("effective_cursor", 0),
                  cursors.get("pending_cursor", 0)]
    return max(n for n in candidates if type(n) is int and n >= 0)


def should_run(latest, accepted):
    if type(latest) is not int or type(accepted) is not int:
        raise ValueError("Invalid control preflight counters.")
    return latest > accepted


if __name__ == "__main__":
    recent = latest_intent()
    accepted = advertised_cursor()
    needed = should_run(recent, accepted)
    # GitHub writes only this explicit output; never a guessed publication.
    print("pending=" + ("true" if needed else "false"))
