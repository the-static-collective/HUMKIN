# HUMKIN RADIO — THE PRODUCTION ROOM

## Status (2026-11-14)

**Operational now, once deployed:** A private, owner-authenticated, browser-based Cart Machine / Pilot Hour builder at `https://humkin.abundent.org/fm/studio/`. All work is done through Supabase and GitHub Pages, so **there is no home-computer requirement**. Recorded audio remains in existing HUMKIN buckets. The station's live browser radio keeps working unchanged.

**Not yet broadcasting:** A continuous public Icecast signal, live mic takeover, caller playback, AI-generated broadcast voices, and a true shared transmitter. No user audio has been uploaded or aired as part of this project. CUE only previews in the user's own browser.

## The cart machine

A *cart* is a short or long already-recorded audio segment assigned to a department. Its `track_id` points at an existing published HUMKIN recording; it does NOT duplicate MP3 bytes. The categories are Station ID, Newsroom, Comedy, Sponsor/Ad, Community, Promo, Field Report, Weather and Odds & Ends.

Procedure: Upload MP3 or WAV via the existing Crate Loader; publish it; for speech, jingles and commercials mark it as **BUMPER / STATION ID** in Station Manager so it does not pollute regular Road Shuffle. Then open The Production Room, choose the recording, department and cart label, add editorial notes and save. Use **CUE** to hear it privately or **+ RUNDOWN** to add it to an ordered program.

The cart library is owner-only in `public.humkin_radio_carts`; Row Level Security restricts reads and writes to the authenticated HUMKIN owner. Removing a cartridge only removes its category/notes pointer, not the recording. Existing studio audio/upload and artwork workflows remain unchanged.

## THE FIRST DAY — 60-minute pilot blueprint

The `DRAFT THE FIRST DAY` button creates an actual timed producer rundown using the published song library, without repeating any song in that draft. It distributes music around seven spoken/editorial beats. These **script placeholders are not audio**; they are visibly identified as requiring a real recording. The user can save and reopen the entire draft across signed-in devices with `humkin_radio_production_drafts`. Editing or clearing on screen does not overwrite the saved draft until **SAVE PRIVATE DRAFT** is pressed.

Narrative beat sheet:

1. **Signed on.** Somebody has purchased the station in the name of an organization that does not legally exist yet. The DJ treats this as a routine operational concern. (Station ID / opening, ~40 seconds)
2. **The Morning News.** The Newsman attempts to locate the purchaser while the purchaser attempts to locate management. (~75 seconds)
3. **The Advertising Department.** Three endorsements have already been sold, but nobody can find the corresponding businesses. Explicitly fictional advertisements are labeled as comedy. (~55 seconds)
4. **One real community bulletin.** A verified, consented local announcement, offered seriously rather than fabricated. (~60 seconds)
5. **The Farm Report.** A field correspondent discovers a tenuous link between the whole situation and turnips. (~65 seconds)
6. **Management's emergency meeting.** The new Station Manager's urgent press conference reveals a basic misunderstanding about how radio works. (~55 seconds)
7. **A sign-off that is not a sign-off.** The staff realizes the station might be real, despite their paperwork. (~45 seconds)

The remaining clock is made of actual existing HUMKIN songs. Times are editorial estimates, not fabricated “generated audio.” The clock displays total running length and any remaining unrecorded slots. Use **ASSIGN** on a script row to replace it with an existing recorded cart. Once every slot references existing *enabled and published* audio, the producer can create a new **PAUSED** 1-hour program in Station Manager. That show remains inactive until the owner explicitly schedules and enables it. No background automatic publication occurs.

**Draft persistence:** This V1 producer room loads the latest saved draft, not multiple named draft folders. Remote changes are saved only on user action; simultaneous editing from multiple devices can overwrite a more recent version, so save before switching devices.

## Modal: yes for cloud production, not our 24/7 transmitter

Modal is a strong fit for *on-demand rendered radio previews*, audio cleanup, stem analysis, voice effects and generating prerecorded shows. Its Starter plan currently advertises $30/month in compute credits. It scales workloads to zero when idle. That is helpful for production jobs, but it is not automatically a permanent 24/7 Icecast service. A continuously available public stream still needs appropriate server/relay infrastructure. Modal Functions have a maximum execution time of 24 hours; cloud producer jobs can be far shorter.

A **non-deployed, opt-in** reference worker now lives at `tools/radio-broadcast/modal_hour.py` and a manual GitHub Actions workflow is in `.github/workflows/modal-preview.yml`.

- Manually trigger `Render a PRIVATE HUMKIN radio preview (Modal)` from GitHub Actions, choosing 1/5/10/20/30/60 minutes.
- Requires **working** Modal token pair in repository GitHub Secrets (`MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`). Previous unrelated JAR;VIS attempts with Modal reported malformed tokens; nothing here assumes those credentials are currently usable. Never paste tokens into chat or repository files.
- Modal runs the existing FFmpeg radio source engine **in fast file-output mode**, pulls the existing published catalog, and places the resulting MP3 in private Modal Volume `humkin-radio-renders`. No workstation is required if GitHub Actions credentials are configured.
- **It does not yet render the current producer-draft order.** This first cloud prototype creates a private sample from the standard published station rotation. Binding selected studio rundown plus approved recorded carts to the renderer is the next development increment.
- A render is neither publicly aired nor uploaded automatically. Retrieve it explicitly via `modal volume get humkin-radio-renders <file>.mp3` or the Modal storage interface. Only then choose whether to publish it using the Crate Loader.
- Running a cloud job spends compute credits. The manual job has no schedule or autoplay. Check Modal workspace budget before long render sessions.

## Engineering and safety

The two new tables, `humkin_radio_carts` and `humkin_radio_production_drafts`, have RLS, owner-only grants and no anonymous read permissions. Public listeners cannot see editorial notes or upcoming pilot drafts through the Data API. Existing radio audio and public schedule stay unchanged.

The production UI uses a publishable browser key + verified owner session, not an admin/service-role key. All HTML from catalog titles, editorial text and labels is inserted as `textContent` rather than raw HTML. The local cue player does not transmit.

No station has been activated by deploying this producer room; converting a complete draft to a scheduled show requires owner action and an explicit later station-manager activation.

## Next after this

1. Record three short real IDs plus the Newsman and Manager's first sketches. Use the phone/Suno or existing audio workflow.
2. Stock carts and replace the pilot's seven placeholders; save the private draft.
3. Attach a studio rundown to the Modal rendering worker and render one actual rehearsal hour without a computer at home.
4. Add a controlled request inbox and explicit public-versus-fictional newsroom pipeline.
5. When broadcast hosting is ready, wire the real live stream to the existing HUMKIN receiver.
