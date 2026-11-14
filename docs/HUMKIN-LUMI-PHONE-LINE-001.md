# HUMKIN RADIO — LUMI × REQUEST LINE 001

**Date:** 2026-11-14 · **Status:** prepared, signed telephony receiver + private moderation desk. A phone number has **NOT** been purchased or provisioned; the phone gateway is deliberately disabled. No actual caller, outbound message, AI greeting or voicemail has been field-tested.

## Two doors, not one authority

We already have **LUMI LINE 001** in the independent `the-static-collective/the-static-collective` experiment PR #16, with separate Supabase Edge Function `lumi-line`. It is an **owner-allowlisted, disabled-by-default experimental AI voice/SMS doorway**, not a general radio request number and **not an instance of this ChatGPT conversation**. Private ChatGPT memory and JAR;VIS project tools are *not connected* there.

This change creates a distinct **HUMKIN RADIO REQUEST LINE** gateway on the same Supabase project, but with separate public Twilio webhook URLs, a different database, a separate consent path and separate enable flag. Both may use the **same Twilio provider account**. A single shared number with a real authenticated private staff extension could be built later, but we do **not** expose the owner-only AI line by using a public number.

Producer policy:
- Listener requests, recordings and incoming phone numbers are NOT a grant to air or quote any person.
- The public telephone line never receives private JAR;VIS/ChatGPT data, contacts, admin tools or outbound calling capability.
- The line is a **recorded inbox**, not a live phone-in stream. The Newsman/fictional DJ can later respond to **approved, consented** submissions as a separate HUMAN production action.
- Do not expose private prayer requests, personal identifying details, financial info, addresses, donor information or minors' identities.

## Current UI

- `https://humkin.abundent.org/fm/line/`: public request-line page. Displays **NO PUBLIC NUMBER YET** unless the website config **and** deployed gateway health both confirm active. The fake number is never emitted to users.
- `https://humkin.abundent.org/fm/line/manage/`: owner-only inbox for text requests and voicemail metadata; owner login uses existing Crate Loader authentication, with owner-only Supabase RLS.
- The main FM page and Production Room link to these pages. `request ≠ approved ≠ aired`.

## Implemented gateway

Supabase `pantry-gate` separate function: `humkin-radio-line`.

Public status:
`GET https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-radio-line/health`

Twilio webhook targets (POST, application/x-www-form-urlencoded):

- **Incoming voice:** `.../humkin-radio-line/voice`
- **Incoming SMS:** `.../humkin-radio-line/sms`

The signed internal Voice/TwiML action paths are `/choose`, `/consent?topic=song|story`, `/recording`, `/done`. Only Twilio with a valid HMAC-SHA1 signature over the **exact** webhook URL and parameters can use them. We additionally check Twilio Account SID and dialed HUMKIN number on voice/SMS requests; voicemail completion must bind to a previously signed, keypad-consented call, and is idempotently stored under its recording SID.

Voice call script:
1. An independent HUMKIN greeting explicitly says this is **not live**. Press **1** to request a song or **2** to leave a story/community idea.
2. Explicit separate keypad **1** required to consent to a recorded message for private producer review. Declining or hanging up creates no audio recording.
3. Max **90-second** beeped voicemail; native Twilio provider stores the recording. The Supabase DB stores **only** the recording SID, duration, short HMAC-hashed caller tag and editorial state—**not** a public recording URL or caller telephone number.
4. A recording is **never automatically aired**. For playback/review, a human checks the provider's secure recording console and independently obtains/checks permission before marking it cleared and later confirming it actually aired.

SMS:
- Incoming messages up to 650 characters are classified into `song|story|community|other`.
- Public STOP/HELP/START and other carrier commands are not ingested; the provider remains responsible for regulated messaging consent, opt-out and A2P 10DLC.
- Incoming replies use an empty TwiML `<Response/>`: **no outbound SMS** is generated, so this code will not trigger a paid AI reply.
- Messages have an owner-only pending review queue. HMAC caller tag and maximum five accepted messages per caller per hour reduce abuse and avoid storing raw numbers.
- SMS senders do not grant broadcast permission simply by writing in.

**Important legal boundaries:** Telephone calls may cross state lines; comply with applicable recording-notice/consent laws. Phone/SMS charges apply at the provider level even if our function ignores a webhook. Verify voice recording retention and deletion policies at Twilio separately. Public submissions can include unwanted personal data despite the prompt: moderate and delete as appropriate. A private voicemail SID still corresponds to a recording held at the provider.

## One-time activation (explicit human steps)

We can prepare software and operate a website now; **we cannot purchase a number, use a user's Twilio account without connection, or assert a successful phone call.** A US local Twilio number is currently advertised at around **$1.15/month** plus inbound call/SMS usage, carrier fees and any required US A2P 10DLC registration charges. Check the exact number's voice+SMS capabilities before purchase.

1. In the user's Twilio account, provision a **separate public HUMKIN number** with inbound Voice and SMS. It can share the provider account with experimental private LUMI LINE, but do not merge access controls.
2. In Supabase `pantry-gate` → Edge Function secrets, set:
   ```text
   TWILIO_AUTH_TOKEN=<Twilio account auth token>
   TWILIO_ACCOUNT_SID=AC...<32 hex>
   HUMKIN_LINE_NUMBER=+1XXXXXXXXXX
   HUMKIN_LINE_CALLER_PEPPER=<random 20+ char private secret>
   HUMKIN_LINE_ENABLE=false
   ```
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be available to the Edge runtime. Never paste tokens into chat, GitHub files or browser JS.
3. Set the number's **voice webhook URL** to `https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-radio-line/voice`, method **POST**; SMS webhook to `https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-radio-line/sms`, method **POST**. Do not route a public listener number to private `lumi-line` or OpenAI SIP.
4. Ensure SMS registration/compliance as required for the message use case. Define intended audience, studio hours and acceptable message contents. Inspect Twilio recording privacy/retention settings.
5. Set `HUMKIN_LINE_ENABLE=true` **only after** operator review, secrets and webhook configuration. Inspect health `ready:true`. Verify from real devices: 1 and 2 voice choice, refusal to record, explicit recording consent, max length, callback deduplication, SMS category/STOP, private inbox and owner RLS.
6. **Only after real phone tests** edit `fm/line/config.json`: `state:"active"`, `number:"<verified E.164>"`, `voice_enabled:true`, `sms_enabled:true` as appropriate. The public UI requires *both* `state=active` and gateway health `ready=true` before showing buttons.
7. Turn on monitoring, billing alerts and a provider-level call/SMS cap. Choose a retention window and delete irrelevant recordings at provider and in owner inbox.

At no time does deploying this repo automatically purchase, connect, turn on or publish a phone number.

## Next: the AI receptionist / newsroom bridge

The public request line can eventually greet callers with a fictional DJ or Lumi voice, but that is a **separate future integration** requiring real voice-provider/project credentials, recording/caller consent, spending caps, a provider adapter, prompt-injection-safe retrieval of public programming only, and human review before any listener audio goes on air. Never pass private owner materials directly into a public model context.

The natural next bridge is **REQUEST → human moderation → rights-reviewed cart → approved studio rundown → actually aired receipt → possible response**, borrowing Kinship's editorial record and Rock Impact's record-first preservation. The current phone line deliberately stops at the private pending inbox.

## Tests and deployment

`node tests/radio-line.test.mjs` simulates signed Twilio form callbacks with realistic SID shapes, valid/invalid signatures, explicit keypad recording consent, SMS classification/STOP handling, owner pending inbox, no raw caller numbers and no outbound AI usage. GitHub CI includes the test.

Database tables: `humkin_radio_line_inbox` (owner SELECT/UPDATE/DELETE only; caller never exposed), `humkin_radio_line_call_consents` (service-only). Both use RLS. The function's own service key is accessible exclusively at the Edge, never at the frontend.

Read-only test gate: service health should be 200 and `ready:false` until phone secrets are set and the owner explicitly enables the line. Signed live call verification is necessarily still pending.
