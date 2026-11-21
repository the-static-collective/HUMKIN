(() => {
  "use strict";

  const stations = [
    {name: "Station One", lane: "Flagship", copy: "The eclectic HUMKIN broadcast. The classic player carries the titles and cover art, Road Shuffle and Hear the New One.", receiver: "../fm/#receiver"},
    {name: "Top 40", lane: "Heavy rotation", copy: "Big hooks, new singles and the records worth hearing twice."},
    {name: "Deep Cuts", lane: "Album tracks", copy: "B-sides, long tracks and the rest of the record."},
    {name: "Night Drive", lane: "After dark", copy: "Slow burns and wide-open songs for the road after midnight."},
    {name: "Porch & Field", lane: "Roots", copy: "Folk, Americana, field recordings and the sound of a room."},
    {name: "The Workshop", lane: "Instrumentals", copy: "Instrumentals, beats and long stretches for making things."},
    {name: "Sunday Signal", lane: "Gospel & worship", copy: "Gospel, worship and songs worn smooth by singing together."},
    {name: "Talk & Tape", lane: "Voices", copy: "Interviews, stories and recordings people made to be heard."},
    {name: "Living Archive", lane: "Historical audio", copy: "Older music and unusual recordings with their sources and credits attached."},
    {name: "The Strange Hour", lane: "Experimental", copy: "Mutant pop, experiments and songs that make their own genre."}
  ];

  const byId = id => document.getElementById(id);
  const grid = byId("stations");
  const detail = byId("station-detail");
  const link = byId("station-tune");
  const room = byId("listening-room");
  const mount = byId("receiver-mount");
  const fullReceiver = byId("full-receiver");
  const heading = byId("receiver-title");
  const motion = byId("motion");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  let frame = null;
  let receiverSize = null;
  let opener = null;

  function selectStation(station, announce = false) {
    for (const button of grid.children) {
      button.setAttribute("aria-pressed", String(button.dataset.station === station.name));
    }
    byId("station-status").textContent = station.receiver ? "Receiver available" : "In development";
    byId("station-name").textContent = station.name;
    byId("station-copy").textContent = station.copy;
    link.hidden = !station.receiver;
    if (station.receiver) link.setAttribute("href", station.receiver);
    if (announce) {
      byId("station-announcement").textContent =
        station.name + (station.receiver ? ". Receiver available." : ". In development.");
    }
  }

  for (const station of stations) {
    const button = document.createElement("button");
    const name = document.createElement("strong");
    const lane = document.createElement("span");
    button.type = "button";
    button.className = "station";
    button.dataset.station = station.name;
    button.setAttribute("aria-controls", "station-detail");
    name.textContent = station.name;
    lane.textContent = station.lane;
    button.append(name, lane);
    button.addEventListener("click", () => selectStation(station, true));
    grid.append(button);
  }

  selectStation(stations[0]);
  detail.hidden = false;

  function openReceiver(event) {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const trigger = event.currentTarget;
    const target = new URL(trigger.href);
    event.preventDefault();
    selectStation(stations[0]);
    opener = trigger;
    if (!frame) {
      const receiver = document.createElement("iframe");
      receiver.title = "Station One audio player";
      receiver.src = target.href;
      receiver.allow = "autoplay";
      receiver.addEventListener("load", () => {
        const desk = receiver.contentDocument?.getElementById("receiver");
        if (!desk || typeof ResizeObserver !== "function") return;
        receiverSize = new ResizeObserver(() => {
          receiver.style.height = Math.ceil(desk.getBoundingClientRect().height) + "px";
        });
        receiverSize.observe(desk);
      });
      fullReceiver.href = target.href.replace(/#.*$/, "");
      frame = receiver;
      mount.append(frame);
    }
    room.hidden = false;
    heading.focus({preventScroll: true});
    room.scrollIntoView({block: "start"});
  }

  for (const trigger of document.querySelectorAll("[data-tune]")) {
    trigger.addEventListener("click", openReceiver);
  }

  byId("close-receiver").addEventListener("click", () => {
    receiverSize?.disconnect();
    receiverSize = null;
    frame?.remove();
    frame = null;
    room.hidden = true;
    (opener?.hidden ? grid.firstElementChild : opener)?.focus();
    opener = null;
  });

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
