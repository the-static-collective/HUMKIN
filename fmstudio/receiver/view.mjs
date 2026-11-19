/* Presentation adapter: replace any station art or palette without touching audio. */
import {safeArt, skinFor} from "./core.mjs";
const SOURCE = new URL("./skins.json", import.meta.url);
const DEFAULT_ART = new URL("../../cover.jpg", import.meta.url).href;

export async function loadSkins() {
  try {
    const result = await fetch(SOURCE, {cache: "no-cache"});
    if (!result.ok) throw Error("Skin file missing");
    const data = await result.json();
    return data?.schema === "humkin.fm.receiver-skins/v1" &&
      data.stations && typeof data.stations === "object" ? data.stations : {};
  } catch { return {}; }
}

export function createReceiverView(mount) {
  // This template contains no station identity, audio URL or generated HTML.
  mount.innerHTML = `
    <div class="humkin-receiver" data-layout="console" data-mode="idle">
      <div class="receiver-backdrop" aria-hidden="true"></div>
      <div class="receiver-content">
        <div class="receiver-artbox">
          <img class="receiver-cover" alt="Station artwork" src="${DEFAULT_ART}">
          <img class="receiver-overlay" alt="" hidden>
        </div>
        <div class="receiver-readout">
          <div class="receiver-station-id">
            <img class="receiver-badge" alt="" hidden>
            <span class="receiver-frequency">HUMKIN RADIO · LIVE</span>
          </div>
          <h4 class="receiver-track">Live radio</h4>
          <p class="receiver-artist">Track details appear when verified by the transmitter.</p>
          <p class="receiver-caption"></p>
          <div class="receiver-transport">
            <button class="receiver-play" type="button" aria-label="Play station">▶ Listen Live</button>
            <span class="receiver-indicator" aria-hidden="true"></span>
            <span class="receiver-status" role="status" aria-live="polite">Ready to tune</span>
          </div>
          <audio class="receiver-audio" controls preload="none" aria-label="Live radio audio"></audio>
          <p class="receiver-footnote">One receiver, one broadcast. This station's artwork can change without changing its audio.</p>
        </div>
      </div>
    </div>`;
  const box = mount.querySelector(".humkin-receiver");
  const cover = mount.querySelector(".receiver-cover");
  const overlay = mount.querySelector(".receiver-overlay");
  const badge = mount.querySelector(".receiver-badge");
  const playButton = mount.querySelector(".receiver-play");
  const track = mount.querySelector(".receiver-track");
  const artist = mount.querySelector(".receiver-artist");
  const status = mount.querySelector(".receiver-status");
  const stationLabel = mount.querySelector(".receiver-frequency");
  const caption = mount.querySelector(".receiver-caption");
  const audio = mount.querySelector("audio");
  let art = DEFAULT_ART, stationName = "Station One", currentSkin = {};
  function setArtwork(url, description) {
    cover.src = url;
    cover.alt = description;
  }
  function applySkin(id, name, definitions = {}) {
    stationName = name;
    currentSkin = skinFor(id, definitions, SOURCE.href);
    art = currentSkin.artwork;
    box.dataset.layout = currentSkin.layout;
    for (const [key, value] of Object.entries({
      "--receiver-accent": currentSkin.accent,
      "--receiver-background": currentSkin.background,
      "--receiver-foreground": currentSkin.foreground,
      "--receiver-muted": currentSkin.muted,
      "--receiver-frame": currentSkin.frame,
      "--receiver-background-image": currentSkin.backgroundArt
        ? 'url("' + currentSkin.backgroundArt + '")' : "none"
    })) box.style.setProperty(key, value);
    overlay.hidden = !currentSkin.overlayArt;
    if (currentSkin.overlayArt) overlay.src = currentSkin.overlayArt;
    else overlay.removeAttribute("src");
    badge.hidden = !currentSkin.badgeArt;
    if (currentSkin.badgeArt) badge.src = currentSkin.badgeArt;
    else badge.removeAttribute("src");
    caption.textContent = currentSkin.caption || "";
    stationLabel.textContent = stationName.toUpperCase() + " · LIVE";
    track.textContent = stationName + " · Live";
    artist.textContent = "Track details appear when verified by the transmitter.";
    setArtwork(art, stationName + " artwork");
    audio.setAttribute("aria-label", stationName + " live audio");
    playButton.setAttribute("aria-label", "Play " + stationName);
  }
  function render(state) {
    box.dataset.mode = state.mode;
    box.dataset.playing = String(state.playing);
    const playing = state.playing;
    playButton.textContent = playing ? "Ⅱ Pause" : "▶ Listen Live";
    playButton.setAttribute("aria-label", (playing ? "Pause " : "Play ") + stationName);
    status.textContent = state.status;
    const verified = state.mode === "hls" ? state.track : null;
    track.textContent = verified?.title || stationName + " · Live";
    artist.textContent = verified
      ? [verified.artist, verified.album].filter(Boolean).join(" · ")
      : "Transmitter-verified titles appear here when available.";
    setArtwork(verified?.artwork ? safeArt(verified.artwork, SOURCE.href) : art,
      verified?.title ? verified.title + " cover artwork" : stationName + " artwork");
    if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
      try {
        navigator.mediaSession.metadata = state.mode === "idle" ? null : new MediaMetadata({
          title: verified?.title || stationName + " · Live",
          artist: verified?.artist || "HUMKIN RADIO",
          album: verified?.album || stationName,
          artwork: [{src: cover.src, sizes: "512x512", type: "image/jpeg"}]
        });
      } catch {}
    }
  }
  return {audio, playButton, applySkin, render};
}
