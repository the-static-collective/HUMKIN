# ANDROID-031 · Multi-band responsive enamel chassis

**Goal:** The user wants a radio that behaves like an expanding physical object, not a poster scaled to width and not a small radio floating over a navy rectangle. The supplied narrow lightning-bolt/paint screenshot illustrates the repeatable edge-texture principle.

## Construction

The original 864×1536 illustrated receiver remains the sole canonical chassis art. We divide it into **four physically fixed image bands** and **three expandable dark-blue gasket zones**:

| Seam, reference Y | Relative share of extra vertical room | Physical location |
| --- | ---: | --- |
| 681 | 35% | Below the actual knobs/switches, above the now-playing record card |
| 1197 | 42% | Below TUNE IN and its motto, above the brass speaker grille |
| 1369 | 23% | Below the speaker grille, above the four tab buttons |

Each seam expands only when the visible Android window is taller than the width-scaled original. The percentage allocation sums to 100%—the **entire viewport** becomes illustrated radio, without a separate empty blue block underneath.

The inserted artwork is a true **three-column tile**. The left and right 23px rails are cloned from the original device's scratched border. The center is a repeatable, dark-navy inpaint sampled from source pixels matching the original enamel color; no numbers, lightning motifs, song titles, screws, or other recognizable objects repeat. The tile is cropped/repeated vertically as necessary. Fixed bands continue using precisely the original source pixels at the original proportions.

`ReceiverSliceGeometry.mapY()` is the common coordinate transform for drawing, button bounds, album artwork, tuner motion, response labels and the PAUSE placard, so no overlaid control drifts out of alignment when spacers expand.

## Behavior and continuity

- This is a new version of **the same** `org.abundent.humkinradio.pocket` app, with version code 32 (Pocket Receiver 0.32.0). Installing over 030 retains that app's existing local data.
- The underlying Media3 audio engine, album metadata, HUM wallet, same-time scheduling, shuffle, outpost and server bindings are unchanged.
- In portrait, the receiver measures the actual Android `ScrollView` viewport and fills it. On narrow/tall displays, new blue body texture appears **between** modules, not exclusively at the bottom.
- On short/landscape viewports, the receiver retains its original physical aspect and scrolls rather than squashing hardware.
- Accessibility semantics, touch handlers, and native playback buttons remain their own Views.

## Tests and limitations

`ReceiverSliceGeometryTest` checks that expansion fills the requested height, all share percentages sum to 1, short windows do not distort, and the original fixed sections retain exact heights.

The expanded paint uses source-derived texture synthesis on first construction of the view. It is deliberately low-contrast and does not repeat detailed ornaments. The canonical image currently in the GitHub repository was previously imported through Canva; improvement to the original-res asset can happen independently. Visual validation against the user's exact device screenshot is still necessary, because the Android CI proves compilation and Java tests rather than final handset appearance.

**HUMKIN web radio is unchanged.**
