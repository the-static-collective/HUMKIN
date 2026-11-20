# HUMKIN Tower on the Acer

Tower is the local broadcast console for HUMKIN. It opens in a browser on the Acer and runs alongside the station's HLS encoder. One media crate serves all frequencies on that computer. Each has its own queue, rotation settings and broadcast.

## Open the Tower

Use the complete updated HUMKIN checkout. If the earlier Station One version is running, stop it with its existing `STOP-HUMKIN-LIVE.cmd` and wait for it to exit. Run `tools\radio-broadcast\windows\START-HUMKIN-LIVE.cmd` from the new checkout. The existing Windows R2 vault is reused. Open `OPEN-HUMKIN-TOWER.cmd` from the same folder once the publisher starts.

- **Upload & queue** accepts multiple audio files and places them in the selected frequency's queue. The crate keeps the original files, deduplicates identical audio by hash, and reads existing title, artist, album and embedded cover tags.
- **Coming up** shows the manually queued tracks first, then the active show or automatic rotation. Drag tracks or use the arrow buttons within each lane. **Queue this show for editing** lets you run a reordered copy of its upcoming sequence.
- **Play next**, **Skip now**, **Hold**, **Disable**, and rotation weight controls operate while the encoder runs. Use **Add to rotation** to bring an uploaded track into that frequency's recurring mix.
- **Send to frequency** queues the same crate item on another running frequency. Its current track and queue are independent.

## Batch selection and saved programs (proposed upgrade)

- Every on-air, upcoming and crate recording has a selection checkbox. Click **Select visible** near a list to select its currently displayed page, or check arbitrary tracks across searches, sorting and pages. Up to 250 unique recordings may be in one batch.
- The contextual **Batch programming** panel offers explicit **Hold**, **Release**, **Enable**, **Disable**, **Increase/Decrease rotation weight**, queue operations, adding eligible uploads to rotation, curated-lineup operations and selective shared metadata changes. It previews the intended count and asks for confirmation. These are atomic *within one frequency*: invalid, held, disabled or unavailable items can reject the entire change rather than leaving a partial queue.
- **Send to another frequency** submits one batch to the destination's local authenticated Tower endpoint. The destination's own eligibility rules apply. A disconnection is reported as a failure; check its queue before retrying when delivery confirmation is uncertain.
- **Create program from selection** opens the program editor with the selected recordings in selection order. Give the show a name, add programming notes, reorder or remove tracks, or append additional selected crate tracks. **Save program draft** stores it in that frequency's programming JSON state across transmitter restarts; editing uses optimistic revision checks to refuse stale overwrites.
- Under **Saved programs**, choose **Edit**, **Play next**, **Queue at end**, or **Delete draft**. Inserting a program copies its current ordered track IDs into the manual queue, with one atomic save. Its saved draft stays intact and reusable. Previously queued copies remain unchanged if the saved draft changes or is deleted. A held/missing recording blocks insertion until resolved.
- Batch metadata changes are frequency-local overlays, not source-file tag edits. Normal on-air metadata-cue behavior applies if the current recording is edited. Batch policy changes have one-step **Undo**; queue and program insertion are intentionally not claimed to be reversible through that Undo button.

**Not an automatic on-air publish:** These drafts do not schedule a cloud program or authorize Cloud Autopilot; the reviewed Gambit export and cloud approval remain separate gates. The selection and editor are local to the Acer Tower. Back up the transmitter's existing programming.json state before migrating, stop the broadcaster, update the checkout, then restart. Running playout files should never be replaced in place.

## Saved show → Cloud Autopilot (owner-reviewed handoff)

TOWER can hand a saved program to the existing cloud radio clock **without**
immediately changing the live Acer transmitter, public website, or R2 schedule.

1. Open TOWER on the Acer. In **Saved programs**, select **Prepare cloud show**.
2. Choose the future date and a quarter-hour start in **America/Chicago**.
   Download the **unapproved handoff** JSON. It contains the exact ordered track
   references, their local Acer audio paths, the saved draft revision, and a
   non-cryptographic change-detection fingerprint. Keep this private.
3. Make sure the selected audio files are in the local Acer media crate. The
   first bridge requires **local, playable files**. Remote-only archive/R2
   references, missing files, held/disabled songs, invalid cloud IDs and
   stale program revisions are rejected without creating a cloud schedule.
4. In PowerShell at the HUMKIN checkout, preview the exported file before
   using R2 credentials:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\cloud-autopilot.ps1 -TowerProgram "$env:USERPROFILE\Downloads\humkin-cloud-your-show-2030-01-02.json"
   ```

   Replace the sample filename with the handoff file you actually downloaded.
   Preview transcodes/caches AAC segments locally, verifies imported-audio SHA
   identity and exact program order, and displays the requested slot and show
   duration. It does **not** publish or authorize a broadcast.

5. Once the show and scheduled slot have been reviewed, use the same command
   with **-Publish** added. The existing Acer DPAPI R2 vault must be available.
   It asks the owner to type **PUBLISH AUTOPILOT** before updating the cloud
   schedule. This is the existing credential-backed publication authority,
   not a self-approved program field.

Prerequisite: an approved, seeded **house Cloud Autopilot program** must already
exist for that same frequency. The publisher reads the current revision and
refuses to overwrite an incompatible or unexpectedly changed cloud program.
The requested start is moved forward to the next existing song boundary if
necessary; a cloud revision plays the saved tracks *in exact order*, after
which a second revision restores the prior house rotation. Programs more than
eight hours long, dates too close to now, and overlapping future reservations
are refused. The editor's notes remain editorial text and are not audio
crossfade commands.

After a successful publish, the Acer can be offline during that cloud show.
This is distinct from the ordinary live HLS transmitter: it does not publish
track metadata to the regular Acer live playlist, silently schedule every
saved draft, or automatically syndicate across all frequencies.

## Live-control improvements

- Every visible track (on air, in the upcoming queue or in the media crate) has **Edit metadata**, **Disable / Enable**, **Hold / Release**, and any applicable rotation weight controls.
- **Edit metadata** changes title, artist, album, genre, searchable tags, programming notes and an approved artwork URL, without modifying the audio file. Edits are persisted **per frequency**, so experimental programming does not overwrite the original crate or another station's credits. Artwork URLs must use an approved HUMKIN HTTPS media host.
- When an on-air title or cover changes, the transmitter emits a new cue at the live audio position. Listeners see it when their buffer reaches that cue. Previously published HLS segments are not rewritten.
- Drag from the **Drag to reorder** handle to another row in the same lane, or use the up/down buttons. Track controls remain clickable without accidentally starting a drag. The queue preserves its scroll position during refreshes. If the encoder advances while you move a row, the server rejects an obsolete slot and asks you to try against its refreshed queue rather than moving the wrong recording.
- The web listener no longer treats status-probe timeouts alone as proof the broadcast has stopped, and defers transient background HLS errors until the page resumes. The fallback sources can reconnect to HLS automatically once the real source returns, while respecting the listener's explicit Play and Pause choices.

**Update safely:** These changes are not active on an existing Acer checkout until you update its files and restart the managed transmitter; do not replace the live program files underneath a running broadcast. Save the running program and review the pull request before cutting over. The published website player must be deployed separately from the Acer transmitter. The Tower editor is a local, authenticated control surface and is not exposed to public listeners.

**Scope:** Editing currently changes per-frequency display and playout metadata, station-specific holds/eligibility and rotation/queue relationships. It does not alter source-file ID3 tags, rewrite the global media archive, or automatically synchronize edits between independent running frequencies.


## Program from The Compost Heap

[The Compost Heap](https://humkin.abundent.org/fmstudio/#compost) is a continuous listener-controlled dial over the enabled, published archive. It favors recordings with fewer qualified archive listens and avoids repeats within a browser's rotation. The Tower's **Media crate** can sort by listens, stars, or the **Made me dance** response. These are anonymous listener reports. The Tower makes the programming decision.

Choose a running secondary frequency under **Send tracks to** and click **Add to destination lineup** on a recording. Switch to that frequency and click **Use curated lineup**. Its recurring program will use the saved lineup, while **Send to frequency** still adds a one-off queue entry. The curated selection survives a restart and can be edited from the secondary frequency. **Use standard rotation** switches back if you want the full standard program.

Bring new audio into the private [Crate Loader](https://humkin.abundent.org/fm/load/). When you publish a reviewed recording there, the Heap picks it up automatically. The [MESH inventory](https://humkin.abundent.org/fm/mesh/) tracks private recordings separately from public playout.

## Start another frequency

Run these PowerShell commands from the checkout. Replace `talk` with the frequency's lowercase name. Each active frequency runs its own encoder and publisher on the Acer.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\station-one.ps1 -Action StartR2 -Frequency talk
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\station-one.ps1 -Action LiveStatus -Frequency talk
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\station-one.ps1 -Action StopR2 -Frequency talk
```

Deploy the updated [HLS Worker](R2-LIVE-HLS.md) before using secondary public frequencies or serving embedded covers from uploaded files. A frequency named `talk` is available at `https://humkin.abundent.org/fm/?frequency=talk` after the website update. Station One keeps its existing URLs. Both frequencies keep the normal listener fallback chain.

## Verify live metadata

The Acer marks transitions by the count of PCM samples sent to the encoder. At a crossfade, the title changes at the midpoint. The R2 publisher adds those cues to the manifest alongside completed audio segments. The website uses each listener's playback position, so two listeners buffered differently can see different titles at the same moment. A missing cover uses the station image.

Tune in from a second device and watch a track transition with distinct covers. Move an upcoming track and repeat. The R2 Worker also exposes the latest completed cue at `/hls/now-playing` and `/hls/<frequency>/now-playing` for other clients. That endpoint follows the edge of the published audio, and the browser times its display with the listener's own playhead.

