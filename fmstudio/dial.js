/* HUMKIN FM Studio network dial.
 * One embedded receiver at a time. A fresh, published Acer HLS manifest is the
 * only evidence that a secondary frequency is live; proposed shows stay draft.
 */
(() => {
  "use strict";
  const WORKER = "https://humkin-long-wave.joyvolcanomusic.workers.dev";
  const RECEIVER = "https://humkin.abundent.org/fm/";
  const REGISTRY = WORKER + "/hls/stations";
  const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
  const byId = id => document.getElementById(id);
  const templates = [
    {id: "station-one", name: "Station One", lane: "Flagship",
      copy: "The eclectic HUMKIN broadcast. The classic player carries its titles, cover art and Road Shuffle."},
    {id: "top-40", name: "Top 40", lane: "Heavy rotation",
      copy: "Big hooks, new singles and the records worth hearing twice."},
    {id: "deep-cuts", name: "Deep Cuts", lane: "Album tracks",
      copy: "B-sides, long tracks and the rest of the record."},
    {id: "night-drive", name: "Night Drive", lane: "After dark",
      copy: "Slow burns and wide-open songs for the road after midnight."},
    {id: "porch-field", name: "Porch & Field", lane: "Roots",
      copy: "Folk, Americana, field recordings and the sound of a room."},
    {id: "workshop", name: "The Workshop", lane: "Instrumentals",
      copy: "Instrumentals, beats and long stretches for making things."},
    {id: "sunday-signal", name: "Sunday Signal", lane: "Gospel & worship",
      copy: "Gospel, worship and songs worn smooth by singing together."},
    {id: "talk-tape", name: "Talk & Tape", lane: "Voices",
      copy: "Interviews, stories and recordings people made to be heard."},
    {id: "compost", name: "The Compost Heap", lane: "Living Archive", archive: true,
      copy: "The long tail of the published HUMKIN archive. Less-played recordings go first."},
    {id: "strange-hour", name: "The Strange Hour", lane: "Experimental",
      copy: "Mutant pop, experiments and songs that make their own genre."}
  ];
  const known = new Map(templates.map(station => [station.id, station]));
  const displayed = new Map();
  const states = new Map();
  const grid = byId("stations");
  const link = byId("station-tune");
  const detail = byId("station-detail");
  const announcement = byId("station-announcement");
  const registryStatus = byId("station-registry-status");
  const refreshButton = byId("refresh-stations");
  const room = byId("listening-room");
  const mount = byId("receiver-mount");
  const fullReceiver = byId("full-receiver");
  const heading = byId("receiver-title");
  const motion = byId("motion");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let selected = "station-one";
  let frame = null, activeReceiver = null, opener = null, receiverSize = null;
  let registryReady = false, checking = false;

  function stationName(id) {
    return id.split("-").map(part => part === "fm" ? "FM" :
      part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  function receiverURL(id) {
    if (!ID.test(id)) return null;
    if (id === "station-one") return RECEIVER;
    const url = new URL(RECEIVER);
    url.searchParams.set("frequency", id);
    return url.href;
  }
  function statusFor(station) {
    if (station.archive) return "Available · personal archive rotation";
    if (!registryReady) return "Live status unavailable";
    const state = states.get(station.id);
    if (state?.on_air === true) return "On air · shared live broadcast";
    if (station.id === "station-one" || displayed.has(station.id)) return "Not broadcasting";
    return "In development";
  }
  function canTune(station) {
    if (station.archive || station.id === "station-one") return true;
    return states.get(station.id)?.on_air === true;
  }
  function updateSelection(announce = false) {
    const station = known.get(selected) || known.get("station-one");
    for (const [id, button] of displayed) {
      button.setAttribute("aria-pressed", String(id === station.id));
      const state = button.querySelector(".station-state");
      if (state) state.textContent = statusFor(known.get(id));
    }
    byId("station-status").textContent = statusFor(station);
    byId("station-name").textContent = station.name;
    byId("station-copy").textContent = station.copy;
    link.hidden = !canTune(station);
    if (station.archive) {
      link.href = "#compost";
      link.textContent = "Open The Compost Heap";
      link.target = "_self";
    } else if (canTune(station)) {
      link.href = receiverURL(station.id);
      link.textContent = "Tune to " + station.name;
      link.target = "_blank";
    }
    if (announce) announcement.textContent = station.name + ". " + statusFor(station) + ".";
  }
  function addStation(station) {
    if (displayed.has(station.id)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "station";
    button.dataset.station = station.id;
    button.setAttribute("aria-controls", "station-detail");
    const title = document.createElement("strong");
    title.textContent = station.name;
    const lane = document.createElement("span");
    lane.textContent = station.lane;
    const state = document.createElement("span");
    state.className = "station-state";
    state.textContent = statusFor(station);
    button.append(title, lane, state);
    button.addEventListener("click", () => {
      selected = station.id;
      updateSelection(true);
    });
    displayed.set(station.id, button);
    grid.append(button);
  }
  for (const station of templates) addStation(station);
  detail.hidden = false;
  updateSelection();

  function closeReceiver(restoreFocus = false) {
    receiverSize?.disconnect();
    receiverSize = null;
    frame?.remove();
    frame = null;
    activeReceiver = null;
    room.hidden = true;
    if (restoreFocus) (opener?.hidden ? grid.firstElementChild : opener)?.focus();
    opener = null;
  }
  function openReceiver(event) {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const trigger = event.currentTarget;
    const target = new URL(trigger.href, document.baseURI);
    if (target.hash === "#compost") return;
    if (target.origin !== new URL(RECEIVER).origin || target.pathname !== "/fm/") return;
    const frequency = target.searchParams.get("frequency") || "station-one";
    if (!ID.test(frequency) || (frequency !== "station-one" &&
        states.get(frequency)?.on_air !== true)) return;
    event.preventDefault();
    document.dispatchEvent(new Event("humkin:station-one")); // Pauses Compost without an alternate audio player.
    if (known.has(frequency)) selected = frequency;
    updateSelection();
    opener = trigger;
    const url = receiverURL(frequency);
    if (frame && activeReceiver !== url) closeReceiver();
    if (!frame) {
      const receiver = document.createElement("iframe");
      receiver.title = (known.get(frequency)?.name || stationName(frequency)) + " audio player";
      receiver.src = url;
      receiver.allow = "autoplay";
      receiver.addEventListener("load", () => {
        // Same-origin iframe only. Never access a third-party document.
        const desk = receiver.contentDocument?.getElementById("receiver");
        if (!desk || typeof ResizeObserver !== "function") return;
        receiverSize?.disconnect();
        receiverSize = new ResizeObserver(() => {
          receiver.style.height = Math.ceil(desk.getBoundingClientRect().height) + "px";
        });
        receiverSize.observe(desk);
      });
      mount.append(receiver);
      frame = receiver;
      activeReceiver = url;
    }
    fullReceiver.href = url;
    heading.textContent = (known.get(frequency)?.name || stationName(frequency)) + " receiver";
    room.hidden = false;
    heading.focus({preventScroll: true});
    room.scrollIntoView({block: "start"});
    // The inner receiver's Listen Live button retains user-gesture control.
  }
  for (const trigger of document.querySelectorAll("[data-tune]"))
    trigger.addEventListener("click", openReceiver);
  byId("close-receiver").addEventListener("click", () => closeReceiver(true));
  document.addEventListener("humkin:compost-playing", () => closeReceiver());

  async function refreshStations() {
    if (checking) return;
    checking = true;
    refreshButton.disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const result = await fetch(REGISTRY, {cache: "no-store", signal: controller.signal});
      if (!result.ok) throw Error("Directory unavailable");
      const payload = await result.json();
      if (payload.schema !== "humkin.fm.station-registry/v1" ||
          !Array.isArray(payload.stations) || payload.stations.length > 50)
        throw Error("Unknown directory format");
      const next = new Map();
      for (const item of payload.stations) {
        if (!item || typeof item.id !== "string" || !ID.test(item.id) ||
            typeof item.on_air !== "boolean" || next.has(item.id)) continue;
        if (item.id !== "station-one" && item.on_air !== true) continue;
        next.set(item.id, {on_air: item.on_air});
        if (!known.has(item.id)) {
          known.set(item.id, {id: item.id, name: stationName(item.id),
            lane: "Acer frequency", copy: "Independent frequency programmed in the HUMKIN Tower."});
          addStation(known.get(item.id));
        }
      }
      // If a previous live frequency vanishes from the live registry, retain
      // the tile but mark it offline. No browser timer becomes proof of airplay.
      states.clear();
      for (const [id, status] of next) states.set(id, status);
      registryReady = true;
      const live = [...states].filter(([_, status]) => status.on_air).length;
      registryStatus.textContent = live + " live Acer " + (live === 1 ? "frequency" : "frequencies") +
        " currently published. Other formats remain in development.";
    } catch {
      registryReady = false;
      states.clear();
      registryStatus.textContent = "Live frequency directory unavailable. Classic Station One and the Compost Heap remain accessible.";
    } finally {
      clearTimeout(timeout);
      checking = false;
      refreshButton.disabled = false;
      updateSelection();
    }
  }
  refreshButton.addEventListener("click", refreshStations);
  setInterval(refreshStations, 30000);
  void refreshStations();

  function stopMotion() {
    byId("monitor").classList.remove("moving");
    motion.textContent = "Start the visualizer";
  }
  function syncMotionPreference() {
    stopMotion();
    motion.hidden = reduceMotion.matches;
  }
  motion.addEventListener("click", () => {
    const moving = byId("monitor").classList.toggle("moving");
    motion.textContent = moving ? "Pause the visualizer" : "Start the visualizer";
  });
  reduceMotion.addEventListener("change", syncMotionPreference);
  syncMotionPreference();
})();
