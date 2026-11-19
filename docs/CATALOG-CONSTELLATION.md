# HUMKIN — Record Constellation / Bulk catalog mapping

Status: experimental, on draft PR #145. No production Worker or media publication is changed by this implementation.

## One source, several evidence layers

The existing tools/humkin-radio-batch.py converter now keeps source-relative paths, embedded genre tags, and optional human-provided sidecars, plus source and MP3 hashes. Those are NOT equivalent to verified listening-based genre labels.

A Suno MP3 download is not assumed to contain the original style prompt. If available, provide one via a CSV notes row or a sidecar named like Summer Song.wav.suno.json with JSON fields style and suno_id. An optional Summer Song.wav.description.txt contains a human description. Audio originals remain untouched; none of these files is uploaded by the conversion tool.

## Bulk workflow

1. Run: python tools/humkin-radio-batch.py "D:\Music\Suno Downloads" --out "D:\Music\humkin-ready"
2. The output contains listening MP3s, humkin-crate-manifest.json, humkin-catalog-notes-template.csv, humkin-catalog-candidates.json, and humkin-motif-review-questions.json.
3. Fill optional suno_style, human_description, tags and suno_id in the CSV. The template is generated once and not overwritten after human edits.
4. Rebuild proposals without re-encoding audio: python tools/humkin_catalog_map.py "D:\Music\humkin-ready\humkin-crate-manifest.json" --notes "D:\Music\humkin-ready\humkin-catalog-notes-template.csv" --out "D:\Music\humkin-ready\humkin-catalog-candidates.json"
5. Open fm/tower/catalog.html in a local web server or, after release, the hosted TOWER. Load the candidate JSON, inspect provenance and suggested tags, and explicitly review.
6. Export the private review draft for continued work. Export reviewed public tags separately. The private draft contains descriptions and MUST NOT be committed publicly without review.
7. Stage the MP3 files through the existing owner-only fm/load/ process; publish individual approved recordings as usual. Separately review and commit the public tag export to fm/catalog-enrichment.json. No browser upload of this export is provided.

To preview the local review page from a Windows checkout, run py -3 -m http.server 8765 from the repository root, then navigate to http://localhost:8765/fm/tower/catalog.html.

## Safety and actual station integration

The reviewed public manifest format is humkin.radio.enrichment/v1. Each row includes only mp3_sha256, reviewed:true and up to 32 genre:/mood:/texture: tags. No raw Suno prompts, lyrics, human descriptions, local paths or private audio are exported. Long Wave joins tags only when MP3 SHA matches an independently enabled, published, approved R2 recording. It cannot create airtime, change rights or modify artist credits.

Existing Counterpoint station filters can reference tags such as genre:jazz or mood:warm. Within the current tags filter, any matching tag qualifies; combining independent filter fields is restrictive. Boolean expression trees and genre similarity are future work.

## MOTIF method and proof boundary

The mapping process uses evidence-first MOTIF-inspired steps OBSERVE, HYPOTHESIZE, PROBE, REVISE, PLAN, VERIFY. It records sources for each proposed tag and generates candidate motif.reason-case/v1 questions when competing genre labels appear. The questions have status NOT_RUN: the native MOTIF solver was not executed. This is keyword-based inference from supplied text, not audio understanding or a verified classifier.

Strong next test: a stratified human-labeled sample of recordings, compared to a conventional keyword baseline for precision, recall, helpful station routing, ambiguity and required review minutes. Preserve falsifiers and wrong guesses.

## Large library design

The Worker now pages approved Supabase metadata in batches of 1,000 with a 20,000-track upper bound, independent of the R2 audio storage. Its optional enrichment overlay supports the same bound. New approved songs can join multiple station contracts without MP3 duplication, after explicit catalog tag review and source-controlled publication.

Candidate version families are only *hints* based on source hashes or close titles/durations. Remixes, shortened edits, and stems are not auto-merged.

Future useful instruments: acoustic fingerprints for same-recording detection, optional local loudness/BPM/silence analysis, multi-genre embeddings and nearest-neighbor discovery, artist/exposure fairness rules, attraction/repulsion constraints, version-family relationships, and immutable provenance linking master, compressed copy, artwork, rights and decision history. These are proposed, not built here.

## Verification

python3 tests/radio-catalog-map.test.py
node --test fm/tower/catalog-review.test.mjs tools/radio-broadcast/cloudflare/enrichment.test.mjs

The Long Wave GitHub Actions workflow runs these tests plus existing stream regressions. Real 10–15 GB ingestion and phone listening are separate field checks.
