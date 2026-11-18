#!/usr/bin/env python3
"""Check the IANA Central timezone without PowerShell -c quoting issues.

PowerShell 5.1 can remove nested quotes around America/Chicago when passing
a Python -c snippet to a native executable. A real file avoids that ambiguity.
"""
import sys

try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    zone = ZoneInfo("America/Chicago")
except (ImportError, ZoneInfoNotFoundError) as exc:
    print("TIMEZONE UNAVAILABLE: " + str(exc), file=sys.stderr)
    sys.exit(2)

print("Station timezone OK: " + str(zone))
