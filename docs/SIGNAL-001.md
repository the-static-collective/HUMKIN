# HUMKIN SIGNAL 001 — Make It Yours

**Vertical slice:** real music → personal curation → playable three-song link → another listener can inherit the arrangement.

## Purpose

Every HUMKIN listener has a *little tower*: first a receiver, optionally a selector and inviter. A tower is a cultural metaphor, not a claim of radio-frequency transmission, geographic reach, network service, listening analytics, or verified social presence.

The physical tower, RPG Gambits/Materia, signed network homes, and studio tooling remain independent. This slice proves one real cultural crossing before adding them to a shared capability engine.

## What actually works

- `/fm/signal/` opens the current **published** `/fm/rotation.json` (21 songs at design time), uses only same-origin MP3s, and does not mirror/modify the station playlist.
- A three-slot personal program supports manual song selection and three bounded **programming rules**: across albums, one album, wildcard.
- The player starts only on a human action and progresses through the chosen songs before stopping.
- Signal title and optional text introduction appear in the share URL. This is a link anyone with the URL can open; it is not a private message.
- A receiving listener hears the exact three songs. **Make this one mine** saves a local personal copy, without altering the sender's link or publishing anything.
- The composer's local draft is saved under `humkin-signal-draft-v1`; the existing Orchard's `humkin-orchard-v1` and room name, the private network signing key, the Top 42 and guild HUM balances are untouched.
- Links from the radio, Orchard and existing signed network page lead to the same small composer. The large Orchard network banner becomes one restrained **Make a Signal / Visit the Network** invitation.
- No tracking, earned points, server writes, algorithmic play counts, social posting, audio upload, AI interpretation, or new backend.

## Adjacent systems, not collapsed systems

| Existing organ | Relationship |
| --- | --- |
| HUMKIN RADIO | Authoritative published 21-song catalog; playback does not count as server-certified chart listening. |
| Orchard | Local room name is a suggested title **only on the same origin**; existing XP, objects, room and backups untouched. |
| Orchard Network 004 | Independent opt-in signed homes, presence, trading and server work. A shared Signal link does not establish a key or publish a home. |
| Top 42 | Separate verified rules; Signal listens do not mint votes. |
| Station Guilds | Can submit authorized audio/video work in the existing reviewed desk; a Signal is not a contribution approval. |
| Auto Disco / SIA | Later may consume a reviewed Signal manifest as a source-labeled *proposal*, never invisible auto-canon. |
| GHoT | No compute work is implied by sharing a link. |

## Production gates

```bash
node --test tests/signal.test.cjs
node --test tests/orchard.test.cjs
```

The main validate-site workflow includes the new test. After merge/deployment, manually test at `/fm/signal/` on Android browser and desktop: choose/fill/reorder, playback/automatic transition, share and open the link in a different browser, adopt the guest copy, page reload, and verify the original Orchard save remains intact.

**Important:** Native Android field-test APK packages may use different application IDs and isolated data. This web release does not migrate Android Signal Outpost or native Orchard saves. Do not uninstall the test app on the assumption that its progress will appear in another package.

## Intentional omissions

No new top-level app tab, no pretend combat interface, no audience leaderboard, no auto-generated announcer voice, no public station directory listing, no physical FM broadcast, no automatic publishing, no Google account, and no duplicate ownership ledger.

**Principle:** A listener should be able to make a genuine little piece of culture in under a minute, then return to the radio. More capability can grow behind this invitation without adding another dashboard.
