package org.abundent.receiver

import org.junit.Assert.*
import org.junit.Test

class ReceiverRulesTest {
    private fun listen(station: String, start: Int, end: Int, prior: Listening = Listening()): Listening =
        (start..end).fold(prior) { state, second ->
            state.observe(BroadcastSample(station, second * 1000L, second * 1000L))
        }

    @Test fun earnsOnlyAfterThirtyContinuousSeconds() {
        assertFalse(listen("one", 0, 29).earned)
        assertTrue(listen("one", 0, 30).earned)
    }

    @Test fun interruptedSessionsNeverCombine() {
        val first = listen("one", 0, 16)
        val interrupted = first.observe(null)
        assertEquals(0L, interrupted.qualifiedMs)
        assertFalse(listen("one", 30, 46, interrupted).earned)
    }

    @Test fun stationChangesNeverCombine() {
        val first = listen("one", 0, 20)
        val second = listen("talk", 21, 31, first)
        assertFalse(second.earned)
        assertEquals(10_000L, second.qualifiedMs)
    }

    @Test fun stallsSeeksClockGapsAndBackwardsReset() {
        val starting = listen("one", 0, 12)
        val stalled = starting.observe(BroadcastSample("one", 13_000, 12_000))
        assertEquals(0L, stalled.qualifiedMs)
        val seek = listen("one", 14, 18, stalled).observe(BroadcastSample("one", 19_000, 95_000))
        assertEquals(0L, seek.qualifiedMs)
        val gap = listen("one", 20, 25, seek).observe(BroadcastSample("one", 30_000, 99_000))
        assertEquals(0L, gap.qualifiedMs)
        val backwards = gap.observe(BroadcastSample("one", 31_000, 10))
        assertEquals(0L, backwards.qualifiedMs)
    }

    @Test fun cueTagAttributesAcceptAnyOrderAndExtras() {
        val line = "#EXT-X-DATERANGE:X-HUMKIN=\"YWJj\",END-ON-NEXT=YES,START-DATE=\"2026-11-20T12:00:00Z\",CLASS=\"org.abundent.humkin.track\",ID=\"abc\""
        val attrs = requireNotNull(CueAttributes.fromTag(line))
        assertEquals("YWJj", attrs["X-HUMKIN"])
        assertEquals("2026-11-20T12:00:00Z", attrs["START-DATE"])
        assertNull(CueAttributes.fromTag(line.replace("humkin.track", "wrong")))
    }

    @Test fun selectsListenerCueAndRejectsStaleWindow() {
        val a = Cue(100, "a", "A", "", "")
        val b = Cue(200, "b", "B", "", "")
        val window = CueWindow(100, 300, listOf(b, a))
        assertEquals(a, window.at(199))
        assertEquals(b, window.at(200))
        assertNull(window.at(300))
        assertNull(window.at(99))
    }

    @Test fun orchardRequiresEarnedHumAndTheSameDiscoveredAndVerifiedRecord() {
        assertFalse(Orchard.canRestore(false, setOf("a"), setOf("a"), "a"))
        assertFalse(Orchard.canRestore(true, setOf("a"), setOf("b"), "a"))
        assertTrue(Orchard.canRestore(true, setOf("a"), setOf("a"), "a"))
    }
}
