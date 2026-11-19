"""Keep the transmitting Windows computer awake; never force its display on.

Windows SetThreadExecutionState is per calling thread. Call within the same
publisher thread for the entire broadcast and restore on exit. It prevents
automatic idle SYSTEM sleep, not lid-close, explicit Sleep, power loss or reboot.
"""
from contextlib import contextmanager
import sys


ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001


@contextmanager
def keep_awake_during_broadcast(platform=None, set_state=None, warn=None):
    """Best-effort guard: a power API failure MUST NOT stop the radio."""
    if platform is None:
        platform = sys.platform
    if platform != "win32":
        yield False
        return
    if warn is None:
        warn = lambda message: print(message, file=sys.stderr)
    started = False
    try:
        if set_state is None:
            import ctypes
            set_state = ctypes.windll.kernel32.SetThreadExecutionState
        started = bool(set_state(ES_CONTINUOUS | ES_SYSTEM_REQUIRED))
        if not started:
            warn("HUMKIN: Windows sleep prevention unavailable. Check power settings.")
    except (AttributeError, OSError, RuntimeError) as exc:
        warn("HUMKIN: Could not request Windows idle-sleep guard: " + type(exc).__name__)
    try:
        yield started
    finally:
        if started:
            try:
                # Revoke only our own continuous system-required assertion.
                if not set_state(ES_CONTINUOUS):
                    warn("HUMKIN: Could not release Windows sleep prevention.")
            except (AttributeError, OSError, RuntimeError) as exc:
                warn("HUMKIN: Windows sleep guard cleanup: " + type(exc).__name__)
