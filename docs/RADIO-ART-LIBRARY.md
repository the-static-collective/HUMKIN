# HUMKIN RADIO — Reusable Cover Art Library

## Why this is separate from music metadata

The Station Manager now has **one reusable image shelf** rather than embedding image files in each song or show. Each uploaded cover gets one immutable, content-addressed JPEG in Supabase Storage and one row in `public.humkin_radio_art_assets`. Tracks, legacy (GitHub Pages) tracks and recurring programs refer to it by `art_asset_id`.

This means the **same cover can be assigned to several recordings or shows without duplicate uploads**, and changing one recording's assigned art does not disturb another.

## Owner workflow

1. Open the Station Manager at `https://humkin.abundent.org/fm/manage/` and sign in with the same owner account used for the Crate Loader.
2. In **00 · THE COVER ART SHELF**, choose a JPG, PNG or WebP. The browser center-crops a square and makes a JPEG (up to 1024 px per side); the original image stays on the device. There is a 10 MiB input cap, a 5 MiB compressed-output cap, and the bucket only accepts JPEG. SHA-256 detects exact duplicate optimized images.
3. The new art appears in the reusable shelf. Select a track's **EDIT** control, then select that cover from **Track cover** and press **SAVE CHANGES**. Both uploaded/cloud tracks and original 21 legacy tracks can link an image.
4. For a show, open **EDIT LINEUP** or **MAKE A NEW SHOW**, select **Program cover**, then save the show. **No program cover** restores track-cover behavior.
5. **No custom cover** on a track restores its pre-existing album/default art. No audio, metadata title or artist is changed by uploading an image.
6. Reuse an image for other songs or shows by selecting the same library entry. The gallery thumbnails are tappable to choose art for an open editor. Any assignment is committed only when the user presses that editor's Save button.

**Cover priority on the radio:** active scheduled program cover → currently playing track cover → existing original-album cover or HUMKIN default. Program art overrides track art only while that program is active in **Same-Time Radio**. **Road Shuffle** displays the assigned track cover. The same image is reflected in the browser's Media Session metadata (Android lock screen).

Listeners must refresh the radio page to receive newly assigned artwork. Static images are loaded by public URL; the browser or CDN may cache their content. This library uses immutable, hash-based filenames, so replacing an image means uploading a new one and assigning it—no stale in-place replacements.

## Storage / RLS / privacy

- Supabase project: existing `pantry-gate` project. Art bucket `humkin-radio-art` is **public**, with JPEG-only content and a 5 MiB per-file limit. Do not put private photos here. Public access is necessary for unauthenticated listeners.
- `humkin_radio_art_assets` rows contain owner UID, SHA-256, storage path, friendly filename-derived label, dimensions, bytes, and creation time. Anonymous reads are allowed. Only verified owner `us@abundent.org` with matching `auth.uid()` may insert/update. Storage INSERT is also owner-only, restricted to the owner's UUID folder.
- `humkin_radio_tracks.art_asset_id`, `humkin_radio_static_overrides.art_asset_id`, and `humkin_radio_programs.art_asset_id` are nullable foreign keys. No existing metadata or files were modified while adding these fields. Referential integrity ensures all linked art exists in the shelf.
- UI uploads use the **public publishable API key**, never a service-role key. Source image bytes are never uploaded until they have been compressed to JPEG locally.
- The shelf intentionally has **no Delete Asset control in V1**. Removing an art assignment leaves the shared image intact for any other uses. Future garbage collection needs a reference audit to avoid breaking other songs/shows.
- Artwork consumes the **same Supabase organization storage allowance** as the existing radio MP3s. One optimized 1024px JPEG is usually much smaller than a music recording, but large galleries are not free.

## Testing scope

GitHub CI verifies URL/path safety, cover fallback priority, owner-only client usage, presence of track/show assignment controls, import and JavaScript syntax, and the radio fixture's Media Session cover display. Supabase migration/policies were verified from project metadata and advisors.

**Field test still required:** Android upload and canvas decoding on the user's physical phone, a new JPEG file upload/registration, then selecting art for a cloud track and scheduled show and refreshing the listener page. There were no user images uploaded as part of this build.

## Next options

A manual crop/reposition slider, image history/version grouping, art label editing, album-level default covers, batch assignment, profile/avatar art, visual show banners and artwork requests can be added on top of this reusable storage model without reworking the music catalog.
