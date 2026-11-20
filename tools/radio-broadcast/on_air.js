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
let archiveScores = new Map();
let archiveBusy = false;
let catalogLimit = 75;
const selectedIds = new Set();
let shownCrate = [];
let shownQueue = [];
let programDraft = null;
let programsViewKey = null;

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
    track.kind === "bumper" ? "Bumper" : "", track.in_lineup ? "Curated lineup" : "",
    track.genre || "", track.tags ? "Tags: " + track.tags : ""].filter(Boolean).join(" · ");
  if (context === "catalog" && track.score) {
    const score = track.score;
    info.textContent += " · " + score.plays + " archive listens";
    if (score.ratings) info.textContent += " · " + score.stars + " ★ (" + score.ratings + ")";
    if (score.dance) info.textContent += " · " + score.dance + " dance";
  }
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
      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.textContent = "Drag to reorder";
      handle.draggable = true;
      handle.setAttribute("aria-label", "Drag " + track.title + " to another position");
      handle.addEventListener("dragstart", event => {
        dragging = track;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", track.id);
      });
      handle.addEventListener("dragend", () => {
        dragging = null;
        row.classList.remove("drop-target");
      });
      row.prepend(handle);
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
      if (latest.can_curate) controls.append(button(track.in_lineup ? "Remove from lineup" : "Add to lineup",
        track.in_lineup ? "lineup_remove" : "lineup_add", track));
      if (track.uploaded && !latest.curated) controls.append(button(track.rotation ? "Remove from rotation" : "Add to rotation",
        "rotation_upload", track));
      if (peerList.some(peer => peer.id !== latest.frequency))
        controls.append(button("Send to frequency", "route", track));
      if (byId("route").value && byId("route").value !== "station-one")
        controls.append(button("Add to destination lineup", "route_lineup", track));
    }
  }
  // Every recording is editable and disableable, including queued and on-air rows.
  controls.append(button(track.held ? "Release hold" : "Hold 1 hour", "hold", track));
  controls.append(button(track.disabled ? "Enable" : "Disable", "disable", track));
  if (track.rotation) {
    controls.append(button("Less often", "less", track, track.weight === -2));
    controls.append(button("More often", "more", track, track.weight === 2));
  }
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "Edit metadata";
  edit.dataset.action = "metadata_edit";
  edit.dataset.track = track.id;
  edit.setAttribute("aria-label", "Edit metadata · " + track.title);
  edit.addEventListener("click", () => openEditor(track));
  controls.append(edit);
  row.dataset.track = track.id;
  row.append(title, info, controls);
  {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "track-checkbox";
    box.dataset.selectTrack = track.id;
    box.setAttribute("aria-label", "Select " + track.title);
    box.checked = selectedIds.has(track.id);
    box.addEventListener("change", () => {
      if (box.checked) selectedIds.add(track.id);
      else selectedIds.delete(track.id);
      updateSelection();
    });
    row.prepend(box);
  }
  return row;
}

function renderRows(id, data, render, extra = null) {
  const container = byId(id);
  const key = JSON.stringify([data, extra]);
  if (id === "queue" && dragging) return;
  if (viewKeys.get(id) === key) return;
  viewKeys.set(id, key);
  const buttons = [...container.querySelectorAll("button")];
  const focused = document.activeElement;
  const index = buttons.indexOf(focused);
  const scrollTop = container.scrollTop;
  container.replaceChildren(...render());
  container.scrollTop = scrollTop;
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
  const sort = byId("crate-sort").value;
  const tracks = latest.catalog.filter(track => (sort !== "lineup" || track.in_lineup) &&
    [track.title, track.artist, track.album, track.genre, track.tags, track.notes].join(" ").toLowerCase().includes(query));
  const tally = track => archiveScores.get(track.id);
  tracks.sort((a, b) => {
    let difference = 0;
    if (sort === "plays") difference = (tally(a)?.plays ?? Infinity) - (tally(b)?.plays ?? Infinity);
    if (sort === "stars") difference = (tally(b)?.stars ?? 0) - (tally(a)?.stars ?? 0);
    if (sort === "dance") difference = (tally(b)?.dance ?? 0) - (tally(a)?.dance ?? 0);
    return difference || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
  const shown = tracks.slice(0, catalogLimit).map(track => ({...track, score: tally(track)}));
  shownCrate = shown.map(track => track.id);
  const hasPeers = peerList.some(peer => peer.id !== latest.frequency);
  renderRows("catalog", shown, () => shown.length ? shown.map(track => trackRow(track, "catalog")) :
    [empty("No matching tracks.")], [hasPeers, byId("route").value, latest.curated]);
  byId("catalog-more").hidden = tracks.length <= catalogLimit;
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
  const first = !latest;
  latest = {...state, catalog: state.catalog || latest?.catalog || []};
  setConnection(true);
  byId("archive-tools").hidden = !state.tower;
  byId("lineup-mode").hidden = !state.can_curate;
  byId("lineup-mode").textContent = state.curated ? "Use standard rotation" : "Use curated lineup";
  if (first && state.tower) refreshArchive();
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
  renderPrograms();
  updateSelection();
}

function renderQueue() {
  const page = latest.queue.slice(0, visible);
  shownQueue = page.map(track => track.id);
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

function openEditor(track) {
  if (busy || !connected) return;
  const current = latest.catalog.find(item => item.id === track.id)
    || latest.queue.find(item => item.id === track.id)
    || (latest.current?.id === track.id ? latest.current : track);
  byId("metadata-id").value = current.id;
  byId("metadata-track").textContent = current.title;
  for (const key of ["title", "artist", "album", "genre", "tags", "notes", "artwork"]) {
    byId("metadata-" + key).value = current[key] || "";
  }
  byId("metadata-dialog").showModal();
  byId("metadata-title").focus();
}

async function sendControl(payload) {
  if (busy || !connected) return false;
  busy = true;
  connectionGeneration++;
  try {
    const response = await fetch("/action", {
      method: "POST",
      headers: {...headers, "Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.state) render(result.state);
    byId("feedback").textContent = result.message || "The station did not accept this action.";
    if (!response.ok && payload.action === "reorder")
      byId("feedback").textContent += " The queue was refreshed; try the move again.";
    return response.ok;
  } catch {
    setConnection(false);
    byId("feedback").textContent = "The station did not confirm this change.";
    return false;
  } finally {
    busy = false;
  }
}

async function act(action, track, target, metadata = null) {
  return sendControl({action, id: track?.id, slot: track?.slot, play: latest.play,
    target, metadata, frequency: byId("route").value});
}

function updateSelection() {
  for (const box of document.querySelectorAll("[data-select-track]"))
    box.checked = selectedIds.has(box.dataset.selectTrack);
  byId("batch-panel").hidden = selectedIds.size === 0;
  byId("batch-count").textContent = selectedIds.size + " selected";
}

function selectVisible(ids) {
  for (const id of ids) if (selectedIds.size < 250 || selectedIds.has(id)) selectedIds.add(id);
  updateSelection();
  if (selectedIds.size >= 250) byId("feedback").textContent = "Maximum 250 selected tracks per batch.";
}

function catalogTrack(id) {
  return latest.catalog.find(track => track.id === id)
    || latest.queue.find(track => track.id === id)
    || (latest.current?.id === id ? latest.current : null);
}

function draftButton(label, callback, disabled = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.disabled = disabled;
  element.addEventListener("click", callback);
  return element;
}

function renderProgramTracks() {
  if (!programDraft) return;
  const list = byId("program-tracks");
  list.replaceChildren(...programDraft.track_ids.map((id, index) => {
    const item = document.createElement("li");
    const track = catalogTrack(id);
    const title = document.createElement("strong");
    title.textContent = (index + 1) + ". " + (track?.title || "Unavailable recording: " + id);
    const controls = document.createElement("div");
    controls.className = "controls";
    const move = direction => {
      const destination = index + direction;
      if (destination < 0 || destination >= programDraft.track_ids.length) return;
      const ids = programDraft.track_ids;
      [ids[index], ids[destination]] = [ids[destination], ids[index]];
      renderProgramTracks();
    };
    controls.append(
      draftButton("↑", () => move(-1), index === 0),
      draftButton("↓", () => move(1), index === programDraft.track_ids.length - 1),
      draftButton("Remove", () => {
        programDraft.track_ids.splice(index, 1);
        renderProgramTracks();
      })
    );
    item.append(title, controls);
    return item;
  }));
}

function openProgramEditor(program = null) {
  if (!connected) return;
  programDraft = program ? {...program, track_ids: [...program.track_ids]} : {
    id: null, revision: null, name: "", notes: "", track_ids: [...selectedIds]
  };
  byId("program-name").value = programDraft.name;
  byId("program-notes").value = programDraft.notes;
  renderProgramTracks();
  byId("program-dialog").showModal();
  byId("program-name").focus();
}

function renderPrograms() {
  const programs = latest.programs || [];
  const key = JSON.stringify(programs);
  if (key === programsViewKey) return;
  programsViewKey = key;
  byId("program-count").textContent = programs.length + " saved";
  const list = byId("program-list");
  list.replaceChildren(...(programs.length ? programs.map(program => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = program.name;
    const details = document.createElement("p");
    details.textContent = program.track_ids.length + " tracks · Revision " + program.revision;
    const controls = document.createElement("div");
    controls.className = "controls";
    controls.append(
      draftButton("Edit", () => openProgramEditor(program)),
      draftButton("Play next", async () => {
        if (confirm("Insert " + program.name + " before the current upcoming queue?"))
          await sendControl({action: "program_queue", program_id: program.id,
            revision: program.revision, placement: "next"});
      }),
      draftButton("Queue at end", async () => {
        if (confirm("Append " + program.name + " to the upcoming queue?"))
          await sendControl({action: "program_queue", program_id: program.id,
            revision: program.revision, placement: "end"});
      }),
      draftButton("Delete draft", async () => {
        if (confirm("Delete saved draft " + program.name + "? Queued copies will remain."))
          await sendControl({action: "program_delete", program_id: program.id,
            revision: program.revision});
      })
    );
    item.append(title, details, controls);
    return item;
  }) : [empty("No saved programs on this frequency yet.")]));
}

async function applySelectedBatch() {
  if (!selectedIds.size || busy || !connected) return;
  const action = byId("batch-action").value;
  const ids = [...selectedIds];
  const remote = action.startsWith("route_");
  const operation = action === "route_end" ? "queue_end"
    : action === "route_lineup" ? "lineup_add" : action;
  const target = byId("route").value;
  if (remote && (!target || target === latest.frequency)) {
    byId("feedback").textContent = "Select another running frequency under Send tracks to.";
    return;
  }
  const what = remote ? operation + " on " + target : operation;
  if (!confirm("Apply " + what.replace(/_/g, " ") + " to " + ids.length + " selected recordings?")) return;
  const payload = remote
    ? {action: "batch_route", operation, frequency: target, ids}
    : {action: "batch", operation, ids,
       field: byId("batch-field").value, value: byId("batch-value").value};
  if (await sendControl(payload)) {
    selectedIds.clear();
    updateSelection();
  }
}

let connectionGeneration = 0;
async function refresh() {
  const generation = connectionGeneration;
  try {
    if (busy || dragging) return;
    const version = latest ? "?version=" + encodeURIComponent(latest.catalog_version) : "";
    const response = await fetch("/state" + version, {headers});
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
byId("metadata-cancel").addEventListener("click", () => byId("metadata-dialog").close());
byId("metadata-form").addEventListener("submit", async event => {
  event.preventDefault();
  const id = byId("metadata-id").value;
  const metadata = Object.fromEntries(
    ["title", "artist", "album", "genre", "tags", "notes", "artwork"].map(key =>
      [key, byId("metadata-" + key).value])
  );
  // Close before rendering the changed record; focus is returned to the list.
  byId("metadata-dialog").close();
  await act("metadata_edit", {id}, null, metadata);
});
byId("more").addEventListener("click", () => {
  visible += 60;
  renderQueue();
});
async function refreshArchive() {
  if (archiveBusy || !latest?.tower) return;
  archiveBusy = true;
  const message = byId("archive-status");
  try {
    const response = await fetch("/archive", {headers});
    if (!response.ok) throw new Error();
    const {ids, scores} = await response.json();
    archiveScores = new Map(ids.map(id => [id, {plays: 0, ratings: 0, stars: 0, dance: 0}]));
    for (const score of scores) if (archiveScores.has(score.id)) archiveScores.set(score.id, score);
    message.textContent = ids.length.toLocaleString() + " published archive recordings";
    renderCatalog();
  } catch {
    message.textContent = "Archive and ratings are temporarily unavailable.";
  } finally {
    archiveBusy = false;
  }
}


byId("batch-select-crate").addEventListener("click", () => selectVisible(shownCrate));
byId("batch-select-queue").addEventListener("click", () => selectVisible(shownQueue));
byId("batch-clear").addEventListener("click", () => { selectedIds.clear(); updateSelection(); });
byId("batch-action").addEventListener("change", () => {
  byId("batch-metadata").hidden = byId("batch-action").value !== "metadata";
});
byId("batch-apply").addEventListener("click", applySelectedBatch);
byId("batch-create").addEventListener("click", () => openProgramEditor());
byId("program-cancel").addEventListener("click", () => {
  byId("program-dialog").close();
  programDraft = null;
});
byId("program-add-selected").addEventListener("click", () => {
  if (!programDraft) return;
  for (const id of selectedIds)
    if (!programDraft.track_ids.includes(id) && programDraft.track_ids.length < 250)
      programDraft.track_ids.push(id);
  renderProgramTracks();
});
byId("program-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!programDraft || !programDraft.track_ids.length) {
    byId("feedback").textContent = "A program needs at least one recording.";
    return;
  }
  const program = {...programDraft,
    name: byId("program-name").value, notes: byId("program-notes").value};
  if (await sendControl({action: "program_save", program})) {
    byId("program-dialog").close();
    programDraft = null;
  }
});

setInterval(refreshFrequencies, 4000);
setInterval(refreshArchive, 60000);
byId("archive-refresh").addEventListener("click", refreshArchive);
byId("lineup-mode").addEventListener("click", () => act("lineup_enable"));
byId("catalog-more").addEventListener("click", () => { catalogLimit += 75; renderCatalog(); });
byId("route").addEventListener("change", renderCatalog);
for (const [id, event] of [["search", "input"], ["crate-sort", "change"]]) {
  byId(id).addEventListener(event, () => { catalogLimit = 75; renderCatalog(); });
}
byId("undo").addEventListener("click", () => act("undo"));
refresh();
