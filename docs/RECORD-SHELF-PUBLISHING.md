# HUMKIN · The living record shelf

**Listener principle:** A record appears only when it exists and is publicly
playable. No “coming soon” slots, fake covers or accidental previews.

## How the Android shelf works

The native app includes **MUTANT POP** and **everywhere;near you** as an offline
fallback. Every time the receiver opens, it also requests the small public
`/releases/catalog.json` over HTTPS. Published records are displayed in the
order declared by that file: **first = newest**. The first record is the
featured album when the listener is not currently playing another album.

The list, cover art and song-list links can change without rebuilding or
reinstalling the app. New cover art is fetched only from the same approved
HUMKIN domain. It is decoded to a small image on a background worker. Bundled
art for the first two records stays available offline. If the public catalog
is missing, empty, invalid or the listener is offline, the built-in records
remain on the shelf. This does not change radio rotation or publish music.

## When the next record is ready

1. Choose a stable lowercase release slug, e.g. `example-record`.
2. Build `releases/example-record/index.html` and put the approved
   `cover.jpg` and all finished, public web listening MP3s under
   `releases/example-record/audio/`. Create
   `releases/example-record/tracks.json` following the current
   `everywhere-near-you` manifest format, with real relative MP3 paths.
3. Verify that the actual public HTTPS URLs work, not only that files exist
   in Git. Do not put private masters, draft titles or unreleased links
   in the public repository or catalog.
4. **At release**, insert this entry as the **first** item in
   `releases/catalog.json`:

   ```json
   {
     "id": "example-record",
     "title": "Actual Album Title",
     "detail": "One brief listener-facing sentence.",
     "status": "published",
     "manifest": "/releases/example-record/tracks.json",
     "cover": "/releases/example-record/cover.jpg",
     "page": "/releases/example-record/"
   }
   ```

5. Confirm the website validation and Android build tests pass. After
   publication, reopen the native app with internet access. Verify the
   new card appears first, has its real cover, that **Featured Album**
   points to it, and that **Play** streams every track through Media3.
   Test switching back to the radio while the album is playing, a phone
   call, and lock-screen audio on an actual Android device.

**Important:** `status: "draft"` is not an invitation to put unfinished
music in the public file. Keep the unpublished release entirely outside the
public Pages tree. Catalog entries marked anything except `published`
are ignored by the app as an additional guard, not a substitute for privacy.

## What changes without a new APK?

- Adding a new published album: **catalog and release files only**.
- Changing editorial featured record: move the desired published record to
  the top; do not fabricate a release date.
- Updating a published title/description/cover: edit the catalog and assets,
  then verify. Native client fetches on open; existing connected clients
  may continue showing previously cached artwork for the current session.
- Android system changes, new station game features, permanent offline
  bundle art, or app signing: **new APK still required**.

The shelf deliberately retains one **Singles** shuffle lane, the compact
featured/playing panel, and one **Back to Radio** button; it does not add
extra navigational links.
