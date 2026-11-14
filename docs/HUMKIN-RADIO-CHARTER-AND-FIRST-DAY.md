# HUMKIN RADIO — THE STATION AT THE END OF THE DIAL
## Operating charter & first-day production packet · v001

**Status (November 14, 2026):** This packet is original, ready-to-record **writing**. The script vault and proposed programming clock are not recordings, completed programs, live broadcasts, or a genuine continuously hosted audio stream. The Station Manager, Cart Machine, crate upload and website are working; a true hosted transmitter and public telephone number still require outside setup.

### Founding proposition

*The world may be falling apart. The radio isn't. Although the radio may occasionally be falling apart.*

HUMKIN is the station that refuses to go silent: beautiful music from an existing original catalog; absurd, persistent coworkers who think they operate a larger institution; and real neighbors who can exchange useful information when people choose to help. It should sound **warm, imperfect, funny, and inhabited**, never like a relentless synthetic newsfeed.

This is original character/world development influenced by the general atmosphere of cozy post-apocalyptic fiction, small-market radio, and workplace comedies. **Do not reproduce Fallout's recordings, copyrighted game dialogue, branded station jingles, character identities, sound libraries, or music.** Design our own radio voice and motif.

The station's listener-facing promise:

> Good music. Good company. Useful connections. A signal worth keeping.

The station's internal promise:

> **Recorded ≠ approved ≠ actually aired.** We are accountable for the difference.

## The first three things to finish

**1. Make the first station ID real.** Use `fm/studio/` → **THE STATION BIBLE & SCRIPT VAULT** → “THE FIRST DAY — Opening Transmission,” and copy/download the spoken script. Record it with a human voice, or produce a clearly fictional synthetic character with rights-cleared tools; apply the original **Lantern** three-note signature and soft warm-static bed if desired. Master a compact MP3. Upload through Crate Loader; publish and categorize as a **BUMPER / STATION ID** so it doesn't enter normal Road Shuffle. In the Cart Machine, assign the existing audio to the Station ID department. It can be privately cued before release.

**2. Assemble the pilot without inventing audio.** Press **DRAFT THE FIRST DAY**; the existing music catalog fills about an hour around **seven unrecorded speech beats**. Newly integrated scene scripts contain actual read-aloud dialogue, directions and explicit fiction/verification notices. The Community Desk beat is a **hold/template**. Use “ASSIGN” only after recording and publishing a specific reviewed segment, then save the draft. Preserve the original draft as a document until completed.

**3. Add one honest community notice.** A real local offer, need or event must have a source, date, general location, human verification, permission and safe public contact route. Use the Community Desk template only after replacing its bracketed placeholders. If no actual verified bulletin exists, leave that segment out or replace it with a non-factual fictional station ID. **Never invent someone's needs, a disaster, a charity, or contact details to fill radio time.**

## How the first actual hour should sound

Musical programming first. One original HUMKIN song should be able to start playing without commentary. Spoken appearances are sparse; each has a reason to exist. An example clock, with flexible timings:

| Approximate slot | Material | Status |
| --- | --- | --- |
| 00:00 | Opening transmission + The Lantern | Original script, **not yet recorded** |
| 00:45 | Two or three HUMKIN songs | Existing audio; selected by current library |
| ~10:00 | Newsman investigates station ownership | Original fiction script, **not yet recorded** |
| ~11:00 | More music | Existing audio |
| ~22:00 | Kackslacks fictional ad department | Parody, not a commercial offer or sponsorship |
| ~23:00 | Music | Existing audio |
| ~31:00 | Community Desk | **HOLD** until independently verified and approved |
| ~32:00 | Music | Existing audio |
| ~41:00 | Farm Reporter | Original fictional commentary, not actual weather or farm advice |
| ~42:00 | Music | Existing audio |
| ~51:00 | Station Manager reorganizes the newsroom | Original fictional sketch |
| ~52:00 | Music | Existing audio |
| ~59:00 | Hailey Lou, “We Are Still Here” | Original reflective ID; then music continues |

These times are creative targets. Actual timing uses precise song durations in the phone-based producer rundown and may differ. The scene scripts can be shorter than the allotted space; don't artificially slow them to fit a rigid minute marker.

## The canonical creative engine

`fm/studio/station-bible.json` is the single source of truth for the **first** 5 voices, 6 proposed dayparts, 12 original script cards, and sonic ID sketch. `fm/studio/bible.js` converts scripts to explicit **unrecorded** rundown placeholders; `fm/studio/clock.js` distributes the existing published songs around the seven canonical pilot beats. The phone Studio renders it with **COPY SCRIPT** and **+ RUNDOWN**.

The source distinguishes `fiction` from `real_template`. Both remain `type:"script"` and cannot enter a show as audio. A successfully uploaded and published track can be substituted later. The station's RLS-backed drafts stay owner-only.

### Sound rules

- Original three-note **Lantern** motif: **G4 → B4 → E5**, rhythmic values **½ + ½ + 2 beats** at **92 BPM**. This is a proposed arrangement, not a registered station trademark or completed recorded song.
- Keep the user's existing warm analog signal character, generally modest and primarily **exclusive to Same-Time Radio**. Don't bake interference into every track unless a producer explicitly chooses a radio treatment. Don't change Road Shuffle or New Single's clean audio for a joke.
- Original static and a small electrical switch click are enough. Avoid fake federal emergency alert tones, authentic crisis warnings or convincing fabricated breaking news.
- Leave entire songs alone when appropriate. Dramatic continuity comes from repetition of recognizable voices, not constant interruptions.

### A studio staff that has jobs

The **Newsman** investigates station paperwork and refuses to invent facts; the **Station Manager** invents departments before approving equipment; the **Farm Correspondent** notices useful details; **Hailey Lou** treats people as human; and the **Assistant Manager** keeps technical work and editorial receipts honest. The fictional Assistant Manager is a scripted character, **not** a promise that the live ChatGPT assistant, personal memory, or private tools are automatically operating the station.

Let a real engineering victory generate a fictional joke only after it is truly observed. When the public call-in line works, Management may celebrate the invention of the telephone. Before that, don't claim to have received calls.

### Daily clock proposal (not a running 24h schedule)

**06–09 Morning Again:** one welcome and short verified bulletin, mostly music.

**09–12 The Long Way Home:** music discovery and one Newsman dispatch.

**12–15 Department of Afternoons:** music and occasional management sketch/farm report.

**15–18 Roadside Requests:** listener requests only if the public line is activated and submissions were independently approved.

**18–22 Hailey Lou's Porch:** reflective music, consented stories and poems.

**22–06 The Night Shift:** long uninterrupted sets, light station IDs, no urgent fictional interruptions.

These are future show identities, **not active scheduled programs**. Create the programming in the existing Station Manager when a real source has recordings and an operator has reviewed it.

## How to make it an actual transmitter

The present browser radio is enjoyable but not an always-on shared Icecast/AzuraCast signal. Current `fm/rotation.json` deliberately keeps `live_stream_url:null`. Until a real third-party hosted stream is provisioned, a listener's browser acts as its own player.

The previously built [Radio House launch instructions](RADIO-HOUSE-LAUNCH.md) already cover a hosted AutoDJ, owner-reviewed media transfer, public metadata endpoints and a read-only preflight. **No home computer is needed** for the hosted path. Do not purchase hosting or change public stream configuration without the operator's authorization and an actually verified endpoint.

Our LUMI-adjacent phone line (`/fm/line/`) is also **not yet provisioned**. The signed Twilio webhook and owner-only call inbox are software infrastructure, not a purchased public telephone number. When operational, every call and text passes a human editorial filter before becoming a cart, factual claim or joke.

## First broadcast release checklist

| Gate | Done when |
| --- | --- |
| Script | Original dialogue reviewed; clearly labeled fictional or verified factual |
| Sound | Real audio exists; voice recording consent and production rights reviewed |
| Catalog | MP3 uploaded, published and categorized; private CUE works |
| Program | No `type:"script"` placeholders; exact duration and track order checked |
| Scheduling | Owner explicitly activates appropriate show in Station Manager |
| Transmitter | Real HTTPS source plays continuously; independent listener test passes |
| Receipt | A human confirms that particular segment actually aired |
| Community return | Any report of a resolved request is independently verified before being presented as real |

## Operational success measures

The first useful measures are **not** social followers or automated impressions. They are (a) no unreviewed material airing, (b) near-continuous music with healthy audio, (c) repeatable recognizable IDs, (d) actual listener return, (e) one verified and safely handled community connection, and (f) no confusion between fictional news and real help.

The test is beautifully simple: while driving, cooking or working, can somebody enjoy HUMKIN without opening a dashboard? And when they hear another person's voice, does it sound like **someone is there**?

That is the station we are building.
