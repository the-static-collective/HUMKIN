# HUMKIN · Proton Authenticator owner login (alternate to email)

**Purpose:** allow the original Crate Loader \`/fm/load/\` and Linkblocks R2 desk \`/fm/mesh-radio/\` to sign in with a six-digit code from a *new, separate* "HUMKIN Radio" entry in Proton Authenticator. No Vercel, no Tower session, and no changes to the radio catalog / existing owner identity.

## What actually happens

A public GitHub Pages login form sends the 6-digit TOTP code to a dedicated Supabase Edge Function. The Edge Function checks an encrypted TOTP seed in an owner-only row in \`humkin_proton_owner_login\`, throttles invalid attempts atomically and blocks replays. Upon success, it uses Supabase Auth Admin \`generateLink(type:magiclink)\` and verifies the resulting short-lived one-time hash **server-side**. The normal GoTrue user session returned by that exchange is then set with \`supabase.auth.setSession()\` inside the existing Supabase browser client.

Thus all of the existing RLS, owner email checks, and R2 services see a **normal Supabase user session**, not a new custom auth token. The email fallback and crate workflow remain unchanged. TOTP login requires **one** code (the code functions as the primary factor within this custom bridge), distinct from Supabase's native MFA which normally happens only after conventional login.

No provider secrets or service-role credentials go to GitHub Pages. The TOTP seed is 160 bits random, encrypted at rest in Supabase Postgres with AES-256-GCM; the encryption key is derived via WebCrypto HKDF from the server-only existing Supabase service role key with a service-specific salt. Rotating the service-role key will require re-enrolling the authenticator, unless the old seed is rewrapped before rotation.

## Pair once, then use on any computer

1. On a computer already successfully signed into the original HUMKIN Crate Loader via its verified owner email, open \`https://humkin.abundent.org/fm/load/\`.
2. Look for **OR · PROTON AUTHENTICATOR** beneath the existing sign-in section. Press **SET UP PROTON ONCE**.
3. On your phone, open Proton Authenticator and choose to add an account. Scan the QR code labeled "HUMKIN Radio", or enter the one-time manual key. You **do not** need to transfer the old Tower's authenticator secret.
4. Enter the six digits Proton currently shows and press **CONFIRM PAIRING**. Wait for the next code before testing sign-in: the enrollment code is consumed for replay protection.
5. On the Mac or any new machine, open \`/fm/load/\` or \`/fm/mesh-radio/\`, enter a current six-digit code, and press **UNLOCK WITH PROTON**. The existing Supabase owner session is established; the R2 loader and catalog then work as they did with email.
6. The old **email sign-in option remains available** for recovery. Once signed in with email, **RESET PROTON ENROLLMENT** lets the owner pair a new authenticator if their old device is lost. This resets only the Proton login, not any songs or existing cloud credentials.

## Security, limitations, and proof

- Rate limit: maximum 8 attempted codes per 15-minute window, followed by a 15-minute lockout. Code validation allows one 30-second clock step of drift and rejects reuse after acceptance. Login attempt reservation and TOTP-step claiming are atomic DB operations, not browser-local counters.
- Sensitive rows: RLS enabled, table access revoked from \`anon\` and \`authenticated\`. Only the trusted \`service_role\` calls the two rate-control RPCs. Enrollment and reset require an existing *verified owner* Supabase JWT. The dedicated Edge Function's unauthenticated login action is restricted by origin and the rate limiter, not by a JWT (since it exists to create one).
- The service-role-generated one-time magiclink is **verified inside Supabase Edge**, and only access/refresh tokens for the already-existing owner user ID are returned to the trusted origin. No magic-link URL, seed, or access token is placed in browser URL parameters or logged.
- Proton is an authenticator app; it doesn't need a Proton account connection, provider API, or new infrastructure.
- The current email redirect-to-localhost issue remains a separate Supabase Auth dashboard configuration problem, but the Proton path doesn't use any browser redirect.
- If the user has native Supabase MFA-enforced \`aal2\` policies, this first-factor session will not satisfy those; existing HUMKIN R2 authorization currently checks owner identity and email confirmation instead. This custom login does not claim Supabase MFA assurance \`aal2\`.
- This owner-only bridge isn't a multi-user authentication product. A community release would need per-user enrollment, per-principal limits, independently configured encryption keys, rotation/recovery and third-party review.

## Repository / deployment

- Source: \`fm/proton-auth.mjs\`, \`supabase/functions/humkin-proton-login/{index.ts,totp.mjs}\`.
- Migration: \`supabase/migrations/20261119091000_humkin_proton_owner_login.sql\`.
- Test: \`node --test tests/proton-auth.test.mjs\`.
- Publish \`index.ts\` plus its sibling \`totp.mjs\` as the Supabase Edge Function \`humkin-proton-login\`, with \`verify_jwt=false\` because the login action creates a JWT. The Edge function performs internal authentication and origin verification. GitHub Pages deploys only the static UI, not any secret.
- **A successful CI test does not establish that the first real Proton code or GoTrue token exchange works.** Test pairing on an already authenticated device and sign-in on the Mac before calling the feature field-verified.
