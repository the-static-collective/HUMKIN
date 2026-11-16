package org.abundent.humkinradio;

/**
 * Bounded, reproducible air-weather cues: a golden-ratio low-discrepancy walk
 * probes the Mandelbrot set. The escape-time variation perturbs the next cue's
 * spacing, depth and length. No audio files, internet, or unpredictable gain
 * spikes. A seed makes each listening session a different walk.
 */
final class FractalSignalPattern {
    private static final double PHI = (1.0 + Math.sqrt(5.0)) / 2.0;
    private static final double GOLDEN_STEP = 1.0 / PHI;
    private static final double BEAT_MS = 60000.0 / 92.0;
    private final double phaseX, phaseY;
    private long step;

    static final class Cue {
        final long delayMs, durationMs;
        final float depth;
        Cue(long delayMs, long durationMs, float depth) {
            this.delayMs = delayMs;
            this.durationMs = durationMs;
            this.depth = depth;
        }
    }

    FractalSignalPattern(long seed) {
        // Mix the timestamp bits before mapping to [0,1): small seed changes
        // should select noticeably different spots on the fractal plane.
        long x = seed ^ (seed >>> 30);
        x *= 0xbf58476d1ce4e5b9L;
        x ^= x >>> 27;
        x *= 0x94d049bb133111ebL;
        x ^= x >>> 31;
        phaseX = (x >>> 11) * 0x1.0p-53;
        x ^= 0x9e3779b97f4a7c15L;
        x ^= x >>> 30;
        x *= 0xbf58476d1ce4e5b9L;
        x ^= x >>> 27;
        phaseY = (x >>> 11) * 0x1.0p-53;
    }

    Cue next() {
        // A quasi-uniform sweep prevents periodic station-machine cadence;
        // escape-time adds clusters of familiar but never identical behavior.
        double x = fract(phaseX + ++step * GOLDEN_STEP);
        double y = fract(phaseY + step * GOLDEN_STEP * GOLDEN_STEP);
        double escape = mandelbrot(-1.9 + 2.6 * x, -1.2 + 2.4 * y);
        double drift = fract(.58 * x + .25 * y + .17 * escape
                + .09 * Math.sin(step * GOLDEN_STEP * Math.PI));
        long delay = Math.round((10000.0 + 24000.0 * drift) / BEAT_MS)
                * Math.round(BEAT_MS);
        // Soft 8–22% level sags, not dropouts; 280–640 ms each.
        float depth = (float) (.08 + .14 * (.55 * escape + .45 * y));
        long duration = Math.round(280 + 360 * (.50 * escape + .50 * x));
        return new Cue(delay, duration, depth);
    }

    private static double fract(double value) {
        return value - Math.floor(value);
    }

    private static double mandelbrot(double cx, double cy) {
        double x = 0, y = 0;
        for (int i = 0; i < 48; i++) {
            double nextX = x * x - y * y + cx;
            y = 2 * x * y + cy;
            x = nextX;
            double magnitude2 = x * x + y * y;
            if (magnitude2 > 4.0) {
                // Continuous escape bands give more nuance than integer steps.
                double smooth = i + 1 - Math.log(Math.log(Math.sqrt(magnitude2)))
                        / Math.log(2);
                return Math.min(1, Math.max(0, smooth / 48));
            }
        }
        return 1;
    }

    static float envelope(double progress) {
        if (progress <= 0 || progress >= 1) return 0;
        // Gentle attack, short hold, long recovery; no hard volume steps.
        if (progress < .20) return ease(progress / .20);
        if (progress < .38) return 1;
        return 1 - ease((progress - .38) / .62);
    }

    private static float ease(double x) {
        double clamped = Math.min(1, Math.max(0, x));
        return (float) (clamped * clamped * (3 - 2 * clamped));
    }
}
