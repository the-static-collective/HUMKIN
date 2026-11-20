package org.abundent.humkinradio;

import org.junit.Test;
import java.util.HashSet;
import java.util.Set;
import static org.junit.Assert.*;

public final class FractalSignalPatternTest {
    @Test public void seededWalkIsReproducibleButNotUniform() {
        FractalSignalPattern a = new FractalSignalPattern(20261116L);
        FractalSignalPattern b = new FractalSignalPattern(20261116L);
        Set<Long> intervals = new HashSet<>();
        Set<Integer> depths = new HashSet<>();
        for (int i = 0; i < 500; i++) {
            FractalSignalPattern.Cue first = a.next();
            FractalSignalPattern.Cue second = b.next();
            assertEquals(first.delayMs, second.delayMs);
            assertEquals(first.durationMs, second.durationMs);
            assertEquals(first.depth, second.depth, 0);
            assertTrue("Non-disruptive interval", first.delayMs >= 9500 && first.delayMs <= 35000);
            assertTrue("Short fade", first.durationMs >= 270 && first.durationMs <= 650);
            assertTrue("No audio dropout", first.depth >= .079 && first.depth <= .221);
            intervals.add(first.delayMs);
            depths.add(Math.round(first.depth * 10000));
        }
        assertTrue("Events must vary over time", intervals.size() > 20);
        assertTrue("Fractal depth must vary", depths.size() > 20);
    }

    @Test public void seedChangesTheListeningSession() {
        FractalSignalPattern a = new FractalSignalPattern(1);
        FractalSignalPattern b = new FractalSignalPattern(2);
        int different = 0;
        for (int i = 0; i < 60; i++) {
            if (a.next().delayMs != b.next().delayMs) different++;
        }
        assertTrue(different > 40);
    }

    @Test public void envelopeReturnsSmoothlyToCleanVolume() {
        assertEquals(0f, FractalSignalPattern.envelope(-1), 0f);
        assertEquals(0f, FractalSignalPattern.envelope(0), 0f);
        assertEquals(1f, FractalSignalPattern.envelope(.20), 0f);
        assertEquals(1f, FractalSignalPattern.envelope(.38), 0f);
        assertEquals(0f, FractalSignalPattern.envelope(1), 0f);
        for (int i = 0; i <= 100; i++) {
            float sample = FractalSignalPattern.envelope(i / 100.0);
            assertTrue(sample >= 0 && sample <= 1);
        }
    }
}
