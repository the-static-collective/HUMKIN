# GAMBIT PROGRAMMING 002 — contribute a radio hour, review, schedule, return

**Status:** Supabase private proposal table applied and the `humkin-program-proposals` Edge Function deployed on November 19, 2026; integrated source for a review desk and controlled
Cloud Autopilot guest windows. The main live station's player, Long Wave
fallbacks and Station One's true Acer transmitter are not changed. The
Cloudflare Autopilot laboratory still requires its own Worker deployment and
an owner-approved R2 media crate before actual public listening can be proven.

## The flow

```
Listener's priority Gambits
        ↓ proposal with station/day/time/length
Supabase private editorial queue — no broadcast rights, no HUM minted
        ↓ station owner signs in and reviews
Owner-only approved JSON packet
        ↓ owner-held approved music crate + protected Acer R2 vault
Compiler chooses deterministic music; operator confirms publication
        ↓ two future-effective, continuous Cloud Autopilot revisions
Guest program begins at a safe track boundary
        ↓ after agreed duration, current track finishes
Exact prior house rotation resumes without the Acer
```

The compiler never evaluates a user script. Allowed conditions/actions are
enumerated; no unreviewed audio URL, new MP3 or transmitter command arrives
through the proposal. The deck merely orders **existing owner-approved music**.

## Listener: propose a block

1. Open `/fm/orchard/gambits.html` and adjust your ordered local Gambits.
2. Enter a program title, requested day, Central-time quarter-hour and 30–120
   minute duration; optionally describe the show's purpose.
3. Submit and inspect the receipt. The workbench uses the existing private
   Guild participation pass. The submission itself has no credit and no
   public airtime. Guest submissions remain possible without a specific
   Orchard XP level; local XP never grants operator access.
4. You can withdraw while pending. Save your participation pass if needed.

Public function: `humkin-program-proposals`, backed by a **new table** with
RLS enabled, no anonymous table grants/policies, and a service-role-only
review interface. The function enforces schema/date/rule bounds, per-pass,
per-network and global caps; IDs and network addresses are keyed hashes.

## Owner: editorial approval

Sign in with the existing owner authentication (Crate Loader) and open
`/fm/orchard/gambits-review.html`. Inspect the deck, proposed station,
time window, rights, station membership, approved catalog, actual media
availability and schedule conflicts. Approve/decline. Only the signed-in
owner can fetch an approved packet. Download it for a separate publication
step. **Approval is not a booking, R2 write or radio broadcast.**

The exported packet is an owner-session-gated document, **not a
cryptographic signature**. Its final authority derives from the *separate*
R2 publisher's protected credentials and explicit operator confirmation.
A public contributor cannot bypass either boundary by editing localStorage.

## Acer: turn approval into live cloud programming

First, prepare and field-test a real house Cloud Autopilot rotation using
`docs/CLOUD-AUTOPILOT-LAB.md`. Existing review packets cannot be
scheduled until there is a house program to return to.

Download a reviewed packet from the owner desk and retain an explicitly
approved local crate `my-cloud-plan.json`, whose frequency matches the
proposal's station ID. The `--approved-packet` flag uses *only* these
owner-approved local recordings as candidates, and never imports the
proposal's song URLs.

Preview on the Acer:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\cloud-autopilot.ps1 -Plan .\my-cloud-plan.json -ApprovedPacket .\reviewed-hour.json
```

Publish deliberately after reviewing the printed program and costs:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\radio-broadcast\windows\cloud-autopilot.ps1 -Plan .\my-cloud-plan.json -ApprovedPacket .\reviewed-hour.json -Publish
```

The existing Windows encrypted R2 vault is required and the operator must
type `PUBLISH AUTOPILOT`. Segments upload first; then **one R2 program
pointer** commits a pair of revisions: guest start, automatic return to
the previous house mix. The guest's requested start is rounded *forward*
to the next real house track boundary. The return is rounded *forward* to
the next guest track boundary, so timing may exceed the requested duration
by one song; both actual timestamps are printed before commit.

The operator must not schedule overlapping future shows. The compiler
rejects an overlapping future revision and a slot with insufficient lead
time. A program scheduled around the Central-time spring DST gap is
rejected rather than silently selecting a different time. This first
iteration requires the Python `tzdata` package on Windows if no IANA
timezone database is installed.

## Deployment boundary

The SQL migration
`supabase/migrations/20261119224500_humkin_program_proposals.sql`
and Edge Function `humkin-program-proposals` have been applied/deployed to
`pantry-gate`. The separate Edge Function permits anonymous invocation All owner-only actions still verify a *real*
Supabase Auth user via `getUser` and the approved owner identity.
No public SQL access to the private queue: verified `anon` and `authenticated`
roles have no table SELECT privilege, and RLS has zero public policies.
Function deployment and schema verification are not a public browser field test.

This deployment is independent from the older Guild contribution API; do not
modify its mission types or credit ledger. Do not repoint `/fm/`,
`/fmstudio/`, or `/hls/live.m3u8` to the Cloud Autopilot laboratory until
the shared stream passes device tests.

## Proof and remaining frontiers

Code tests check schema bounds, ownership separation, deterministic music
choices, future-only scheduling, daylight-saving gaps, no arbitrary code,
and automatic house rotation return. They do **not** establish physical
broadcast audio or a successful listener experience.

The next useful step: integrate the owner-approved proposal dashboard with
Tower, let the operator assign precise slot/program commitments with a
real conflict calendar, and eventually allow scoped producer approvals with
independently server-verified roles. A review-only acceptance must never
automatically authorize a stranger to publish to a real frequency.
