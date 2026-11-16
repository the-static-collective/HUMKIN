# HUMKIN PARTICIPATION ENGINE 001 — STATION GUILDS

**Status:** Public station mission intake, private file upload and owner-reviewed
nontransferable HUM contribution credit system are deployed. Native Android
v0.17 remains a separate field-test app; owner review has not yet been tested
with a real signed-in session on a physical phone.

## Purpose

Every listener can progress toward actually helping run HUMKIN RADIO without
having to contact the station manager by email. The interface is self-service
and exposes real-world station tasks, not simulated on-air results.

Main page: `/fm/participate/`  
Private owner review: `/fm/participate/review.html`  
Private API: `humkin-participation` Supabase Edge Function  
Private bucket: `humkin-contribution-inbox` (25 MB max, video/audio only)

## Available mission families

| Guild | Accepted-work credit guideline | Mechanics | Weekly cap |
|---|---:|---|---:|
| Street Team | 25 verified HUM | One original disclosed public social post, public proof link, no follower/like requirements | 3 |
| Picture Department | 100–300 verified HUM | Original 15–120s video, MP4/WebM upload up to 25MB or public link | 3 |
| Broadcasters | 70 verified HUM | Original 5–30s audio bumper, private audio upload or public link | 6 |
| Script Seed Garden | 35 verified HUM | Original 30–500-character station script | 6 |
| Newsroom | 90 verified HUM | Original 15–180s feature, private audio or public link | 6 |
| Community Music | 350 verified HUM | Original or licensed song >=45 seconds, private upload or public link | 2 |
| Volunteer Engineers | Up to 400 verified HUM | Candidate computer with owner permission; **no credit for a hardware claim**, acceptance requires verified useful service | 1 |

These are **potential**, capped amounts, not money, crypto, or contractual pay
rates. No work is awarded credit automatically. The owner may reject work
without awarding credit. Content does not enter radio rotation automatically.

## User journey

1. Visit `/fm/participate/` in the browser or the native Guilds tab.
2. Choose a guild; Orchard levels indicate a progression path, but a guest
   submission is always available to avoid a game-rank gatekeeping barrier.
3. Optional public social handle is saved locally on that device, never a
   password or automatic social-network connection. The user manually posts
   according to platform terms and pastes a public URL. Incomplete or
   unverifiable social content is not rewarded.
4. Audio and video creators can choose a file through the phone picker.
   Supabase signs exactly one upload path in a PRIVATE bucket with a temporary
   upload token; the finalization step checks file metadata.
5. A private receipt appears under a random device-local participation pass.
   The pass can be backed up/restored; losing it loses account-free access to
   receipts. **Treat the backup as a private bearer secret.**
6. Reviewers sign in via the pre-existing owner Supabase session and use the
   queue. Accepted work moves atomically to the nontransferable contribution
   ledger, once per submission. The owner reviews rights, disclosures, quality,
   truthfulness and actual useful work before accepting.
7. Contributors see pending/declined/accepted, but their contact details and
   media are never publicly listed.

## Critical distinctions

- **Orchard HUM:** editable device-local game currency from actual listening.
  Not transferable and not trusted by the station.
- **Verified contribution HUM:** private server-backed accounting for
  explicitly reviewed contributions, nontransferable and not redeemable for
  cash. Not imported from localStorage.
- **Top 42 plays:** separately qualified real listening events; submitting a
  post, script, movie, or server claim never increases chart points.
- **Broadcast acceptance:** not implied by approving a submission for credit.
  On-air activation is a distinct operator-controlled action.
- **Node enrollment:** **not implemented.** Reporting ownership of an old
  computer is a candidate interest record, not an authenticated running node,
  benchmark or GHoT lease. Future useful-work rewards require secure,
  independently attested service and permission to run tasks.

## Anti-abuse and transparency

- No third-party social passwords, fake likes/followers, mandatory positivity,
  autoposting, forced sharing, or advertising metrics for currency.
- Every eligible social endorsement should clearly disclose that HUMKIN
  contributor benefits **may** be earned. A candid negative/mixed opinion
  remains valid if honest, original and appropriate.
- Account-free device keys are pseudonymous HMAC identifiers server-side,
  with per-device, per-network, weekly and global submission limits. This is
  a **pilot**, not a Sybil-proof identity system.
- File uploads are bounded to 25MB, media types are allowlisted, private
  bucket only, token short-lived; original audio/video is never placed on
  a public playlist automatically.
- Owner review is checked with a real Supabase Auth user session on the server.
  No user-editable JWT metadata or email text in the browser grants review.
- The reward transaction is a single Postgres RPC whose execute privilege is
  restricted to `service_role`, with per-submission UNIQUE receipt.
- Submission withdrawal is available until acceptance. Withdrawn uploaded
  file objects are deleted through the Storage API. Requests should be
  governed by a future documented retention/removal policy.

## Verification performed

- Public mission GET, disclosure rejection, script POST, private receipt and
  withdrawal: live GitHub CI passed.
- Private 4KB synthetic MP4 Storage upload, finalize to pending_review,
  withdrawal, removal from bucket: live GitHub CI passed. Synthetic content
  was never accepted or aired.
- Atomic accept-review RPC tested inside a SQL transaction and rolled back;
  rewards and test records remained zero.
- Synthetic database rows and test media were cleaned after testing.
- Existing radio, Top 42 and Orchard JS/Node regressions passed.
- Android native file picker + build succeeded in CI. Device camera/gallery
  picker, media playback, file quality, long uploads, poor network and owner
  sign-in still need actual hands-on testing.

## Roadmap and trust boundary

Follow-on features can include OAuth provider connections when a network
permits it and the user explicitly consents, verified live node enrollment,
opt-in station co-production, server-verified identities and durable community
guild history. None of these are quietly activated or claimed live by the
current game.

The public intake function is **not an external payment processor** and should
not be used as a general unreviewed cryptocurrency mint.
