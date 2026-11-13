# HUMKIN POST OFFICE · POSTCARD ART BIBLE v0.1

**Purpose:** an indefinitely expandable collection of illustrated HUMKIN postcards that visitors can choose when building and sharing a three-song mix. The site reads `/postcards.json`; only entries in `published` are selectable. The other ideas are a production queue, **not published assets**.

## Anchors and continuity

The existing visual anchor is the original *MUTANT POP* manga cover, presently served as `/cover.jpg`. A saved earlier art reference, *Cozy Mutant Pop Kitchen Jam*, depicts a cheerful freckled dark-eyed woman with curly dark hair in a messy bun, yellow floral scarf, hoop earrings, cream sweater and denim overalls; beside her a soft-eyed younger dark-haired man in blue flannel. A subsequent older-man portrait, *Laughing Musician in a Cozy Studio*, shows him with longer wavy brown hair, full beard, black rectangular glasses, warm open smile and a worn knitted sweater. Treat that second portrait as **a later-era reference**, not a same-day costume change. Prior album images can have different clothes; preserve faces/relationship more tightly than wardrobe.

Artwork grammar: richly composed hand-inked watercolor/halftone manga, expressive candid gestures, textured paper, vivid but comfortable golden/blue/pink light, carefully observed ordinary domestic surroundings. No glossy plastic CGI finish or text baked into the illustration. Leave enough calm surface for handwritten notes and track names to sit *outside* the image.

Recognizable optional motifs: chipped blue-rimmed cup, rosemary/basil, music instruments, handwriting, crooked frame, folding chairs, little doorways. Do not put all motifs in every picture. Keep characters fictional, not presented as photographs of real people.

**Public-life rule:** fictional narrative artifacts may appear, but do not fabricate a faithful historic cover or claim an old release was present unless the exact older asset has been independently selected and linked to its provenance.

## Eight starter scene briefs

| ID | Working scene | Visual center | Era |
| --- | --- | --- | --- |
| `blue-cup-morning` | Blue Cup Morning | two mugs, the chipped blue cup, sun across a breakfast table | young-adult |
| `walk-home` | Walk Home | grocery bags, side-by-side laughter, pink-blue dusk over town | young-adult |
| `rosemary-garden` | Rosemary Garden | hands in soil planting rosemary, small backyard fence, midday sun | young-adult |
| `under-the-stars` | Under the Stars | quilt on grass, acoustic guitar and scattered fireflies | young-adult |
| `rainy-window` | Rain at the Window | soft reflection in rain-glazed pane, quiet companionship | early-middle |
| `table-for-two` | Another Chair | simple white folding tables, chairs being set for neighbors, community warmth | early-middle |
| `home-doorway` | Door Left Open | blue-painted door, packages, two plants, room made for someone | early-middle |
| `years-later` | Years Later | older couple, longer-haired bearded glasses-wearing man, familiar table and tea cup | older |

### First-wave composition rules

- Crop approximately 8:5 landscape with all key faces in the central 70%, suitable for a small rounded illustration slot on a postcard.
- Illustrations must still read as small thumbnails on a 360-pixel phone.
- Consistent proportions and facial features across scenes; changes in age, hairstyle and wardrobe are **deliberate and indexed**.
- Avoid drawn legible words; card copy, track list and gift messages are live accessible HTML.
- Use original 8 scenes rather than simply recoloring the album cover eight times.
- Ask for one image at a time or use a character reference sheet to reduce identity drift across a set.
- Do not ship broken placeholders. Images graduate from `ideas` to `published` only once the local .webp/.jpg/.png exists in the repo, passes human visual review, and is tested in a shared postcard.

## Publish one more illustration

1. Export a reviewed picture to `postcards/<art-id>.webp` (suggest 1200×750 pixels, visually inspected, compressed reasonably for mobile).
2. Add an object to `postcards.json` `published`:
   ```json
   {"id":"blue-cup-morning","title":"Blue Cup Morning","family":"home","era":"young","src":"postcards/blue-cup-morning.webp","alt":"The recurring manga couple share tea at a sunny kitchen table.","aspect":"landscape"}
   ```
3. Do not remove or rename an existing published ID; shared links use `art=<id>`. Test old links after any rename.
4. GitHub Pages deploys the catalog automatically. The postcard picker is populated from published entries (and always offers **Paper only**), so no code change is necessary.
5. Record date, source image, human approval and age-era in a brief release note. Keep draft ideas separated from actual artwork.

## Architecture and privacy

URL link carries `?mix=01.05.09&card=rose&art=blue-cup-morning&note=...`. The browser resolves the `art` ID **only through the first-party JSON manifest**; unrecognized IDs fall back to the original cover. Shared notes live in URL parameters and are not secret. No login, no server-side postcard storage, no autoplay.

The first published artwork is the existing album cover. The eight IDs above are currently **planned**, not claimed as complete or available on the public page. This distinction should remain explicit until assets actually land.
