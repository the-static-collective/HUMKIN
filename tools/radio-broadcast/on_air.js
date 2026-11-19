const byId = id => document.getElementById(id);
const token = document.querySelector('meta[name="station-control"]').content;
const headers = {"X-Station-Control": token};
const viewKeys = new Map();
let latest;
let busy = false;
let connected = false;
let visible = 60;
let dragging = null;
let peerList = [];

function button(label, action, target, disabled = false) {
  const control = document.createElement("button");
  control.type = "button";
  control.textContent = label;
  control.disabled = disabled;
  control.dataset.action = action;
  control.dataset.track = target?.id || "";
  if (target) control.setAttribute("aria-label", label + " · " + target.title);
  control.addEventListener("click", () => act(action, target, target?.destination));
  return control;
}

function trackRow(track, context, index) {
  const row = document.createElement(context === "current" ? "div" : "li");
  const title = document.createElement("strong");
  title.textContent = track.title;
  const info = document.createElement("p");
  const weight = {"-2": "¼×", "-1": "½×", 0: "1×", 1: "2×", 2: "4×"};
  const lane = {manual: "Queued", show: "Scheduled show", rotation: "Rotation"};
  info.textContent = [track.artist, lane[track.lane], track.disabled ? "Disabled" : track.held ? "Held" : "",
    track.rotation && context !== "queue" ? weight[track.weight] + " rotation" : "",
    track.kind === "bumper" ? "Bumper" : ""].filter(Boolean).join(" · ");
  const controls = document.createElement("div");
  controls.className = "controls";
  if (context === "current") {
    controls.append(button(latest.skip_pending ? "Skipping…" : "Skip now", "skip", track, !latest.can_skip));
  }
  if (context === "queue") {
    if (track.lane === "manual" || track.lane === "rotation") {
      const previous = latest.queue[index - 1];
      const next = latest.queue[index + 1];
      controls.append(
        button("↑ Move up", "reorder", {...track, destination: previous?.slot}, previous?.lane !== track.lane),
        button("↓ Move down", "reorder", {...track, destination: next?.slot}, next?.lane !== track.lane)
      );
      if (track.lane === "manual") controls.append(button("Remove", "remove", track));
      if (track.movable) controls.append(button("Move to end", "move", track));
      row.draggable = true;
      row.addEventListener("dragstart", event => {
        dragging = track;
        event.dataTransfer.setData("text/plain", track.title);
      });
      row.addEventListener("dragend", () => {
        dragging = null;
        row.classList.remove("drop-target");
      });
      row.addEventListener("dragover", event => {
        if (dragging?.lane === track.lane && dragging.slot !== track.slot) {
          event.preventDefault();
          row.classList.add("drop-target");
        }
      });
      row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
      row.addEventListener("drop", event => {
        event.preventDefault();
        row.classList.remove("drop-target");
        if (dragging?.lane === track.lane && dragging.slot !== track.slot)
          act("reorder", dragging, track.slot);
        dragging = null;
      });
    } else if (latest.queue[index - 1]?.lane !== "show") {
      controls.append(button("Queue this show for editing", "use_show_order", track));
    }
  } else {
    if (context === "catalog") {
      controls.append(button("Play next", "queue_next", track, track.held || track.disabled));
      controls.append(button("Add to queue", "queue_end", track, track.held || track.disabled));
      if (track.uploaded) controls.append(button(track.rotation ? "Remove from rotation" : "Add to rotation",
        "rotation_upload", track));
      if (peerList.some(peer => peer.id !== latest.frequency))
        controls.append(button("Send to frequency", "route", track));
    }
    controls.append(button(track.held ? "Release hold" : "Hold 1 hour", "hold", track));
    controls.append(button(track.disabled ? "Enable" : "Disable", "disable", track));
    if (track.rotation) {
      controls.append(button("Less often", "less", track, track.weight === -2));
      controls.append(button("More often", "more", track, track.weight === 2));
    }
  }
  row.append(title, info, controls);
  return row;
}

function renderRows(id, data, render, extra = null) {
  const container = byId(id);
  const key = JSON.stringify([data, extra]);
  if (viewKeys.get(id) === key) return;
  viewKeys.set(id, key);
  const buttons = [...container.querySelectorAll("button")];
  const focused = document.activeElement;
  const index = buttons.indexOf(focused);
  container.replaceChildren(...render());
  if (index >= 0) {
    const next = [...container.querySelectorAll("button")];
    const previousRow = Math.floor(index / (buttons.length || 1) * next.length);
    const matching = next.filter(el => el.dataset.track === focused.dataset.track
      && el.dataset.action === focused.dataset.action);
    const fallback = next.slice(previousRow).concat(next.slice(0, previousRow)).find(el => !el.disabled);
    (matching.find(el => !el.disabled) || fallback || byId(id === "catalog" ? "search" : "undo")).focus();
  }
}

function renderCatalog() {
  if (!latest) return;
  const query = byId("search").value.trim().toLowerCase();
  const tracks = latest.catalog.filter(track => (track.title + " " + track.artist).toLowerCase().includes(query));
  const hasPeers = peerList.some(peer => peer.id !== latest.frequency);
  renderRows("catalog", tracks, () => tracks.length ? tracks.map(track => trackRow(track, "catalog")) :
    [empty("No matching tracks.")], hasPeers);
}

function empty(message) {
  const item = document.createElement("li");
  item.textContent = message;
  return item;
}

function timecode(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function render(state) {
  latest = state;
  setConnection(true);
  byId("elapsed").textContent = state.current
    ? timecode(state.elapsed) + " / " + timecode(state.current.duration)
    : "Waiting for audio";
  renderRows("current", state.current, () => state.current ? [trackRow(state.current, "current")] : [],
    [state.play, state.can_skip, state.skip_pending]);
  byId("frequency").textContent = state.frequency.replace(/-/g, " ");
  byId("upload-panel").hidden = !state.tower;
  renderQueue();
  byId("undo").disabled = !state.undo;
  byId("undo").textContent = state.undo ? "Undo " + state.undo : "Undo";
  renderCatalog();
}

function renderQueue() {
  const page = latest.queue.slice(0, visible);
  renderRows("queue", page, () => page.length
    ? page.map((track, index) => trackRow(track, "queue", index)) : [empty("No tracks pending.")]);
  byId("more").hidden = visible >= latest.queue.length;
}

async function refreshFrequencies() {
  if (!latest?.tower) return;
  try {
    const response = await fetch("/frequencies", {headers});
    if (!response.ok) return;
    const peers = await response.json();
    if (JSON.stringify(peers) === JSON.stringify(peerList)) return;
    peerList = peers;
    const active = byId("route").value;
    const others = peers.filter(peer => peer.id !== latest.frequency);
    byId("route").replaceChildren(...others.map(peer => new Option(peer.id, peer.id)));
    if (others.some(peer => peer.id === active)) byId("route").value = active;
    byId("route").hidden = byId("route-label").hidden = !others.length;
    byId("frequencies").hidden = !peers.length;
    byId("frequency-list").replaceChildren(...peers.map(peer => {
      const row = document.createElement("li");
      const link = document.createElement("a");
      link.href = peer.url;
      link.textContent = peer.id.replace(/-/g, " ");
      if (peer.id === latest.frequency) link.setAttribute("aria-current", "page");
      const track = document.createElement("small");
      track.textContent = peer.current?.title || "Starting";
      link.append(track);
      row.append(link);
      return row;
    }));
    renderCatalog();
  } catch { /* Frequency discovery can recover on the next poll. */ }
}

function setConnection(online) {
  connected = online;
  const text = online ? (latest.preview ? "Local preview" : latest.current ? "Source running" : "Starting source")
    : "Disconnected";
  if (byId("connection").textContent !== text) byId("connection").textContent = text;
}

async function act(action, track, target) {
  if (busy || !connected) return;
  busy = true;
  connectionGeneration++;
  try {
    const response = await fetch("/action", {
      method: "POST",
      headers: {...headers, "Content-Type": "application/json"},
      body: JSON.stringify({action, id: track?.id, slot: track?.slot, play: latest.play, target, frequency: byId('route').value}),
    });
    const result = await response.json();
    if (result.state) render(result.state);
    byId("feedback").textContent = result.message;
  } catch {
    setConnection(false);
    byId("feedback").textContent = "The station did not confirm this change.";
  } finally {
    busy = false;
  }
}

let connectionGeneration = 0;
async function refresh() {
  const generation = connectionGeneration;
  try {
    if (busy || dragging) return;
    const response = await fetch("/state", {headers});
    if (!response.ok) throw new Error();
    const state = await response.json();
    if (generation === connectionGeneration) render(state);
  } catch {
    if (generation === connectionGeneration) setConnection(false);
  } finally {
    setTimeout(refresh, 800);
  }
}

byId("upload").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy || !connected) return;
  const input = byId("files");
  const files = [...input.files];
  if (!files.length) return;
  busy = true;
  connectionGeneration++;
  let added = 0;
  const failed = [];
  for (const [index, file] of files.entries()) {
    byId("feedback").textContent = "Uploading " + (index + 1) + " of " + files.length + " · " + file.name;
    try {
      const response = await fetch("/upload", {
        method: "POST", headers: {...headers, "X-Upload-Name": encodeURIComponent(file.name)},
        body: file
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      added++;
    } catch (error) {
      failed.push(file.name + " · " + error.message);
    }
  }
  input.value = "";
  busy = false;
  byId("feedback").textContent = "Queued " + added + " of " + files.length +
    (failed.length ? ". " + failed.join("; ") : ".");
});
byId("more").addEventListener("click", () => {
  visible += 60;
  renderQueue();
});
setInterval(refreshFrequencies, 4000);
byId("search").addEventListener("input", renderCatalog);
byId("undo").addEventListener("click", () => act("undo"));
refresh();
