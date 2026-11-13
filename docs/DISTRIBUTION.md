# HUMKIN Distribution Station — Integration and Field Notes

Live station: https://humkin.abundent.org/somewhere.html  
Album: https://humkin.abundent.org/  
Portable player: https://humkin.abundent.org/embed.html  
Public catalog: https://humkin.abundent.org/tracks.json  
Discovery: https://humkin.abundent.org/discovery.json  
Free printable QR poster: https://humkin.abundent.org/poster.html\nSix take-one cards: https://humkin.abundent.org/relay.html

## What is actually available

- **Listening rooms:** Five suggested three-song sequences (coffee, work, moving, table, night). Rooms have shareable `?room=...` URLs. User-started playback continues through the three tracks. The track files and sequences are already published.
- **Website embeds:** One song, current three-song room, or the entire album; creates a real iframe snippet and a playable preview. The embed fetches the local track manifest and audio. No login, ads, client analytics, third-party API, or autoplay. Every embed includes a small "GET THIS PLAYER" link to let another website owner install one.
- **Creators:** Contact link opens a prefilled email with the selected room's tracks and a checklist of usage details. This is an *inquiry*, not a license issued automatically.
- **People and streets:** A random three-song manga postcard URL (random art drawn from the published `postcards.json` library, safely validated), native share or copy fallback, and printable poster linked to the existing local QR.
- **Machines:** Static JSON music catalog, discovery/permissions document, examples below. No token, no privileged endpoint and no falsely claimed real-time adoption tracking.
- **Adoption loop:** A public mailto for a venue or host to report a real placement. Permission must be obtained before naming that person/place publicly.

## Embed examples

The exact origin changes if you are previewing the repository under its GitHub Pages subpath. Always use the desired HTTPS URL for the site on which you want the player hosted.

```html
<!-- Three songs -->
<iframe title="Listen to HUMKIN"
  src="https://humkin.abundent.org/embed.html?mix=01.05.09"
  width="100%" height="315" loading="lazy"
  referrerpolicy="no-referrer"
  style="border:0;border-radius:12px"></iframe>

<!-- Single song -->
<iframe title="Listen to HUMKIN"
  src="https://humkin.abundent.org/embed.html?track=09"
  width="100%" height="315" loading="lazy"
  referrerpolicy="no-referrer"
  style="border:0;border-radius:12px"></iframe>

<!-- Entire album -->
<iframe title="Listen to HUMKIN"
  src="https://humkin.abundent.org/embed.html?all=1"
  width="100%" height="315" loading="lazy"
  referrerpolicy="no-referrer"
  style="border:0;border-radius:12px"></iframe>
```

## Machine lookup example

```js
const root = "https://humkin.abundent.org/";
const info = await fetch(root + "discovery.json").then(r => r.json());
const album = await fetch(info.catalog).then(r => r.json());
const coffee = info.presets.coffee.map(number => album.tracks[number - 1]);
console.log(coffee.map(track => track.title));
```

The `tracks[].url` values are *relative to the site root*, not the referring page. Use `new URL(track.url, root)` when needed. The manifest is metadata, not a rights license.

## Rights and responsible placement

The official player and sharing URLs may be embedded or forwarded at no charge. Personal MP3 downloads are offered on the main record page. This does **not** grant permission for video synchronization, broadcast, remixing, resale, commercial redistributions, sublicensing, or business public-performance use.

For film, games, podcasts, church announcements, nonprofit videos, in-store soundtracks or gyms, write to **us@abundent.org** with tracks and use details. HUMKIN should verify generation/subscription/download rights for each song, any third-party materials, distributor agreements, and applicable public-performance or composition rights before approving a use. In particular, a free MP3 download is not itself a replacement for venue licenses, and consumer Spotify is not licensed for public business playback.

Suno's published paid-plan commercial permissions and current terms should be reviewed for the exact works involved (including approved downloads and remix restrictions). Copyright and rights in individual lyrics/compositions may differ from rights in the audio. Avoid asserting that every song is irrevocably public-domain or sublicensable.

## Costs, truthfulness and next experiments

The first station is static, hosted on the existing GitHub Pages site. New costs depend on bandwidth, print runs and any eventual backend features; high-volume audio hosting should be measured. There is no fabricated placement count or visitor tracking.

Proposed next step after real-world trials: **opt-in adoption receipts**, recorded only with explicit permission, pointing to publicly visible host pages. Count active verifiable placements and independently initiated new placements, not anonymous people, impressions, or inferred streams. Do not automatically publish submitted names or email addresses.

## Regression checks

```sh
node tests/site.test.mjs
node tests/postcard-buttons.test.mjs
node tests/distribution.test.mjs
```

Check links on the final HTTPS custom domain and real audio on mobile separately. Automated repository validation does not prove that every independent browser accepts clipboard access or embedded audio playback.
