"""Owner-reviewed chapter metadata for continuous Quiet Frequency audio.
Recording IDs are public-safe stable identities, not private Suno URLs.
A chapter is metadata only; the media asset remains immutable.
"""
import re

RECORDING = re.compile(r"(?:r2-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|rec-[0-9a-f]{64})\Z")

def validate_chapters(chapters, duration_ms):
    if not isinstance(chapters, list) or not 1 <= len(chapters) <= 64:
        raise ValueError("Expected 1–64 reviewed chapter entries.")
    result = []
    previous = -1
    for chapter in chapters:
        if not isinstance(chapter, dict) or set(chapter) != {"start_ms","recording_id","title","artist"}:
            raise ValueError("Chapter requires start_ms, recording_id, title and artist.")
        start = chapter["start_ms"]
        ident = chapter["recording_id"]
        if type(start) is not int or start <= previous or start >= duration_ms or (previous == -1 and start != 0):
            raise ValueError("Chapter starts must begin at zero, increase and remain inside the audio.")
        if not isinstance(ident,str) or not RECORDING.fullmatch(ident):
            raise ValueError("Use a stable public-safe recording ID.")
        for key in ("title","artist"):
            value=chapter[key]
            if not isinstance(value,str) or not 1 <= len(value.strip()) <= 160 or value != value.strip():
                raise ValueError("Chapter credit must be a nonempty trimmed string.")
        result.append(dict(chapter))
        previous=start
    return result

def recording_events(tracks, duration):
    """Return source and recording identities with exact start offsets."""
    offset = 0
    events = []
    for track in tracks:
        length = duration(track)
        events.append(("asset:"+track["asset_sha"], offset))
        if "chapters" in track:
            for chapter in validate_chapters(track["chapters"], length):
                events.append(("recording:"+chapter["recording_id"],offset+chapter["start_ms"]))
        elif track.get("id"):
            events.append(("recording:"+track["id"],offset))
        offset += length
    return events, offset
