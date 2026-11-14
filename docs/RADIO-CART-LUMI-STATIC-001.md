# HUMKIN RADIO — LUMI-STATIC-001 / Department of Static

HUMKIN-RADIO-PRODUCTION
- **Asset ID:** lumi-static-001
- **Station Bible scene:** `id-lumi-static-001` (`fm/studio/station-bible.json`)
- **Classification:** Original fictional station ID; not factual reporting
- **Voice character:** Lumi, Assistant Station Manager
- **Current status (2026-11-14):** `RECORDED` (dry provider preview only). NOT `EDITED`, `RIGHTS_REVIEWED`, `APPROVED`, `SCHEDULED`, or `CONFIRMED_AIRED`.
- **Dry voice provider:** HeyGen Voice, public instant voice **Maren – Conversational & Easygoing**, `voiceId: cf4f0a4bfd6f4ed585f8799ed27707f1`
- **Rendered audio:** MP3, mono, 44.1 kHz, 128 kb/s; provider-reported length **12.064807 s**
- **Provider audio preview URL:** https://resource2.heygen.ai/text_to_speech/51f803118728480caeb4851591b3dfb3/cf4f0a4bfd6f4ed585f8799ed27707f1/id=2b02e8ea828a4b76a7ba55419598fe52.mp3
- **Durability:** Provider preview URL is not an owner-controlled, durable broadcast asset; archive the downloaded audio before it expires.
- **Rights review:** Pending provider-generation license/terms confirmation and owner listening approval.
- **Original sonic logo:** `THE LANTERN`, G4–B4–E5, 92 BPM, warm piano/bell, short relay click. A separate locally rendered source exists in the conversation, but has NOT yet been staged in this repository.
- **Signal sound:** NO STATIC baked into dry voice, logo, or final cart. The 37.8%-intensity warm radio texture belongs exclusively to Same-Time Radio, never Road Shuffle or the New Single button.
- **Proposed placement:** One approved bumper at a clean song boundary after roughly 3 songs (~11 min), contingent on actual uploaded bumper audio and the active `bumper_every=3` setting.
- **Actual aired receipt:** NONE.
- **Music inventory evidence (2026-11-14):** `fm/rotation.json` contains 21 static entries; live Supabase `public.humkin_radio_tracks` contained 49 published songs, of which 48 were enabled. The browser dynamically includes enabled published cloud songs. **69 eligible music selections** (not a proof of successful playback or 69 distinct recordings).

## Spoken copy

> This is Lumi at HUMKIN RADIO. We've moved the static back to its proper department. Road Shuffle is innocent. The new single is innocent. Management remains under investigation. Stay tuned.

## Production handoff

1. Listen to the existing HeyGen preview in the ChatGPT audio player; download it as `lumi-static-001-dry.mp3`. Retain the unprocessed source.
2. Use the separately rendered original Lantern sting. Mix the spoken take after the click/first notes, avoiding clipping, overprocessing and artificial room static. Check the 12-second speech timing, natural breathing, and HUMKIN pronunciation.
3. Export `lumi-static-001-master.mp3` as a separate approved master. Review provider output rights, original material, and actual rendition; human listen/approval is required.
4. Sign into the owner-only **Crate Loader** at `/fm/load/`; upload the MP3, publish it with **kind = bumper** and a recognizable title. The loader only accepts authenticated owner file uploads; a provider audio URL is not itself an uploaded station asset.
5. On the **Cart Machine** at `/fm/studio/`, associate the published bumper track with the `station_id` department and a named cart; check `bumper_every` in the private station manager. Test in Same-Time and Road Shuffle and verify no track is interrupted.
6. Preserve a device recording or other actual evidence before marking it `CONFIRMED_AIRED`. A script, provider preview, published source file or scheduler config alone is not an airing receipt.

**No automated playback is changed by this documentation update.** The hosted 24/7 radio transmitter is not configured in the static rotation (`live_stream_url: null`).
