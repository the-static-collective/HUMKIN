# HUMKIN Creative Commons — bounded prototype 001

Date: 2026-11-13. Status: **draft PR / discovery and local archival intake, not media publication**.

## Promise and boundary

A creative resource can become an ancestor of many works. This prototype separates three operations that must not be collapsed:

1. **DISCOVER / ARCHIVE:** record metadata for a work (even if it is private, unclear, incomplete, weird, or held).
2. **RELEASE / LICENSE:** an authorized party affirmatively offers particular material under stated permissions.
3. **REMIX / RETURN:** someone makes a descendant, preserves parent references, and optionally offers that descendant on its *own* terms.

An archive record is **not** a public copy, a copyright assertion, a license grant, consent from a collaborator, a public-media URL, or a proof that a work is legally protected. A media download or public preview is not a remix license.

## Verified source discovery — bounded, not complete

The following are **source leads**, observed in a targeted Google Drive title search on 2026-11-13. These are NOT complete content-level audits or public releases. The public catalog deliberately omits private Drive IDs and links.

| Family | Source observation | Follow-up |
|---|---|---|
| Manga | 19 named `MANGA ASSEMBLY` folders, 001–019, plus original/remix playlist/reader candidates | enumerate contents and editions, assess permission |
| Games | `TABLETOP GAME LIBRARY — 000 Index & Edition Ledger`, `WHO MURDERED TOMORROW` start, host/case/player packets, `THE NEIGHBOR EXPERIMENT` | inspect and prepare print/play bundles |
| Cards | `TABLE & ROAD — 22 Card Copybook 001`, Master Deck Charter | inspect full deck, source assets and permissions |
| Fellowship footage | `Fellowship Video Backup` folder and edit notes | collaborators' permissions, real-person likeness, soundtrack |
| Paula Flow | `Video Flow Demo 001` and output gallery | collaborator grant before reuse |
| HUMKIN | 12 existing published listen/download MP3s, manga postcard artworks | recording/composition, art, model/platform terms; no blanket remix grant |
| Haunted Toaster | public `the-static-collective/the-haunted-toaster` repo exists | enumerate actual outputs/artifacts independently from code |
| Flow local | creator estimates ~225 generated videos on hard drive | run offline inventory: unverified count, not accessible from this tool |
| Clothing | Kackslack pants and heather-grey women's version were discussed | sketches in earlier chats; Drive search did not confirm assets by these names |
| Physical designs | user reports infrastructure/design archives | separate private inventory and permission assessment |

Do not automatically ingest unrelated Drive documents. Creative inventory must not ingest private legal/case/evidence records, interpersonal correspondence, or another person's work by topic association.

## Public app: `/commons.html`

- Searchable discovery cards from `commons/catalog.json` with **rights-review** badges.
- Public existing HUMKIN preview URLs can be opened; this does not authorize further reuse.
- `OPEN FOR REMIX` requires `availability: "published-cleared"`, `rights.status: "cleared"`, `rights.allow_remix: true`, an explicit license ID and HTTPS license URL, and a public media URL.
- `ASK ABOUT REUSE` drafts an email. No upload backend or automated consent.
- On-device folder/file metadata import, and JSON/CSV export; browser reads file metadata only and never sends it to the site.
- Imported manifests are not silently persisted, shared, merged into the public catalog or treated as releases.

### Scan the local hard drive without uploading video files

Using a computer with Python 3:

```bash
python3 tools/scan_creative_library.py "/path/to/Google Flow videos" --out flow-inventory.json
python3 tools/scan_creative_library.py "/path/to/Google Flow videos" --out flow-inventory.json --hash --probe
```

The script recursively inventories recognized media, images, manuscripts and editable project formats, omits symlinks and hidden directories, produces relative paths and UTC modified dates, and offers optional SHA-256 exact-duplicate detection and optional ffprobe duration. It writes JSON + CSV; it doesn't modify or copy source files. It does **not** create a safety backup of the original video bytes. Inspect output for personal filenames and collaborator information before publishing or uploading it.

The JSON can be loaded into the website's **LOCAL INDEX** in a browser. This does not transport the video bytes to the web.

## Release receipt required for each actual freely reusable asset

Before changing a record to `published-cleared`, establish:

- A particular **file identity** and copy (prefer SHA-256, media type, duration, original/preview relationship).
- Creator(s), AI tool(s) and dates, sources and authorship description; distinguish human creative inputs and generated portions.
- Which rights you actually control; recording vs composition vs visuals vs performers, and platform-output licensing terms.
- Any likeness/privacy/voice/trademark/moral-rights/third-party elements; obtain necessary clearances.
- A specific grant (e.g., correctly selected Creative Commons license, or custom written license vetted for scope), explicitly covering distribution and derivation, commercial use if desired, attribution and other requirements.
- A reproducible license **version** and URL, consent records, and each contributor's actual authority; no unilateral blanket release of collaborators' contributions.
- A functioning public asset URL controlled by appropriate storage, and a clear way to report error/takedown.
- Parent asset identities for a derivative. A remix's license cannot override restrictions inherited from its parents.

Do not infer the right to relicense Suno/Flow/other generated media just from downloading it or holding a paid account. Review the applicable terms **as of that asset's generation and planned release**. This prototype offers no legal warranty.

## Minimal future record

```json
{
  "id": "asset:sha256:...",
  "title": "One eight-second kitchen shot",
  "kind": "video",
  "availability": "published-cleared",
  "asset_url": "https://owned-media.example.org/shot.webm",
  "preview_url": "https://owned-media.example.org/preview.mp4",
  "sha256": "...",
  "source_provenance": {"generator": "named tool", "creation_date": "YYYY-MM-DD"},
  "parents": ["asset:sha256:parent..."],
  "rights": {
    "status": "cleared",
    "allow_remix": true,
    "license_id": "CC-BY-4.0",
    "license_url": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Attribution statement here",
    "reviewed_by": "authorized steward",
    "reviewed_on": "YYYY-MM-DD"
  }
}
```

The example is a *format*, not an actual released asset. Real adoption should additionally have machine-verifiable release/receipt hashes and separate audit logs.

## Media hosting and costs

GitHub Pages is fine for the catalog, small thumbnails, JS and documents, but not a sensible final home for hundreds of large video masters. Keep archive masters in durable private storage with backups; serve consented/public optimized media via a video-capable CDN or object store with actual direct URLs, caching and bandwidth controls. Separate archival preservation from public derivatives; never depend on the public hosting provider as the only copy.

## reLATTE / economic crossing

1. Contributor proposes an asset in a local queue.
2. Rights and trust check emits **HOLD**, **REFUSE**, or explicitly authorized **RELEASE**; a porch/welcome is not itself a license.
3. A released asset carries an immutable original identity, license receipt, and parent graph.
4. A voluntary remix submission identifies its ancestors, introduced changes, creators and separate permission grant; no automatic upload of derived work.
5. Optional creative requests, compute/production sponsorship, credit and useful-work exchanges are separate agreed relationships. Funding a creation does not automatically transfer rights. Attribution/descendant counts do not automatically entitle a share of revenue.

Suggested future bridges: reLATTE for crossing/provenance, MOTIF for useful-candidate discovery, Haunted Toaster for voluntary mutation and production, Free Graph / MEMENTO for contextual lineage, and PENNY/DEALWEAVER for optional settlement. **These are design interfaces, not integrations shipped by this PR.**

## Concrete field test

Take one entirely controlled source clip, make one intentionally credited remix with altered music or assembly, obtain permission from every necessary rightsholder, publish both with hash-identified parent/descendant records, and test the download and attribution experience on a phone. Don't publish bulk Drive or local assets automatically.
