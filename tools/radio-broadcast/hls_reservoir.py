"""Two HLS clock positions over ONE AAC/TS encoder's completed segment history.

Laboratory mode: generates an ordinary hot playlist and a delayed playlist from
the same immutable session/segment keys. It never speculates about future tracks.
No CDN routing or listener cutover is performed by this module.
"""
from datetime import datetime, timedelta
import re

SEGMENT = re.compile(r"segment-([0-9]{10,16})\.ts\Z")
SESSION = re.compile(r"[0-9a-f]{32}\Z")
EXTINF = re.compile(r"#EXTINF:([0-9]+(?:\.[0-9]+)?),")
MAX_SOURCE_SEGMENTS = 120
HOT_WINDOW_SEGMENTS = 12


class IncompleteHistory(ValueError):
    """Not enough successfully encoded segments to create delayed air."""


def parse_hls_history(raw):
    """Strictly parse contiguous, unencrypted FFmpeg AAC/TS live history."""
    if not isinstance(raw, str) or not raw.startswith("#EXTM3U\n"):
        raise ValueError("Missing HLS header")
    if len(raw) > 50000:
        raise ValueError("HLS history too large")
    tags = {}
    segments = []
    duration = None
    pdt = None
    for line in raw.splitlines()[1:]:
        if line.startswith(("#EXT-X-VERSION:", "#EXT-X-TARGETDURATION:",
                            "#EXT-X-MEDIA-SEQUENCE:")):
            tag, value = line.split(":", 1)
            if tag in tags or not value.isdigit():
                raise ValueError("Duplicate or invalid HLS header")
            tags[tag] = int(value)
        elif line == "#EXT-X-INDEPENDENT-SEGMENTS":
            continue
        elif line.startswith("#EXTINF:"):
            match = EXTINF.fullmatch(line)
            if not match or duration is not None:
                raise ValueError("Unexpected HLS segment duration")
            duration = float(match.group(1))
            if not 0.1 <= duration <= 30:
                raise ValueError("Unexpected HLS segment length")
        elif line.startswith("#EXT-X-PROGRAM-DATE-TIME:"):
            if pdt is not None:
                raise ValueError("Duplicate segment timestamp")
            try:
                value = datetime.fromisoformat(line.split(":", 1)[1].replace("Z", "+00:00"))
            except ValueError as exc:
                raise ValueError("Invalid program timestamp") from exc
            if value.tzinfo is None:
                raise ValueError("Program timestamp must include a timezone")
            pdt = value
        elif not line.startswith("#"):
            match = SEGMENT.fullmatch(line)
            if not match or duration is None or pdt is None:
                raise ValueError("HLS segments need safe filenames, durations and timestamps")
            segments.append({"name": line, "seq": int(match.group(1)),
                             "duration": duration, "pdt": pdt})
            duration = None
            pdt = None
        else:
            # Discontinuity, encryption, custom URIs and endlisted VOD are not
            # supported in a continuous-radio reservoir; fail closed.
            raise ValueError("Unsupported HLS history directive: " + line[:70])
    if duration is not None or pdt is not None:
        raise ValueError("Incomplete HLS history")
    if not 3 <= len(segments) <= MAX_SOURCE_SEGMENTS:
        raise IncompleteHistory("Waiting for 3-120 complete HLS segments")
    seq = tags.get("#EXT-X-MEDIA-SEQUENCE")
    if seq is None or seq < 0 or tags.get("#EXT-X-TARGETDURATION", 0) < 1:
        raise ValueError("Missing HLS timeline headers")
    for index, part in enumerate(segments):
        if part["seq"] != seq + index:
            raise ValueError("Non-contiguous encoder media sequence")
        if index > 0:
            previous = segments[index - 1]
            elapsed = (part["pdt"] - previous["pdt"]).total_seconds()
            if abs(elapsed - previous["duration"]) > 2:
                raise ValueError("Segment clock discontinuity")
    return segments, tags["#EXT-X-TARGETDURATION"]


def manifest(segments, session, target_duration):
    if not SESSION.fullmatch(session):
        raise ValueError("Invalid stream session")
    if not segments:
        raise ValueError("An empty HLS window cannot be broadcast")
    lines = ["#EXTM3U", "#EXT-X-VERSION:3",
             "#EXT-X-TARGETDURATION:" + str(target_duration),
             "#EXT-X-MEDIA-SEQUENCE:" + str(segments[0]["seq"])]
    for part in segments:
        date = part["pdt"].isoformat(timespec="milliseconds")
        lines.extend(["#EXT-X-PROGRAM-DATE-TIME:" + date,
                      "#EXTINF:" + format(part["duration"], ".3f") + ",",
                      session + "/" + part["name"]])
    return ("\n".join(lines) + "\n").encode("utf-8")


def air_windows(raw, session, delay_seconds=480, window_segments=HOT_WINDOW_SEGMENTS):
    """Return (hot_manifest, optional_delayed_manifest, all_history_names).

    The delayed window ends at least delay_seconds of *already encoded audio*
    before hot edge, not a speculative wall-clock timestamp. If history is too
    short, the delayed playlist is withheld rather than claiming live status.
    """
    if not isinstance(delay_seconds, int) or not 60 <= delay_seconds <= 600:
        raise ValueError("Reservoir delay must be 60-600 seconds")
    if not isinstance(window_segments, int) or not 3 <= window_segments <= 24:
        raise ValueError("HLS receiver window must contain 3-24 segments")
    segments, target_duration = parse_hls_history(raw)
    hot = manifest(segments[-window_segments:], session, target_duration)
    elapsed = 0.0
    stop = len(segments)
    while stop > 0 and elapsed < delay_seconds:
        stop -= 1
        elapsed += segments[stop]["duration"]
    delayed = None
    if elapsed >= delay_seconds and stop >= 3:
        delayed = manifest(segments[max(0, stop-window_segments):stop],
                           session, target_duration)
    return hot, delayed, [part["name"] for part in segments]
