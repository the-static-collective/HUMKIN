(() => {
  "use strict";
  const endpoint = "https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-compost";
  const get = id => document.getElementById("compost-" + id);
  const audio = get("audio"), listen = get("listen"), next = get("next"), form = get("rating");
  const status = get("status"), stars = get("stars"), reaction = get("reaction"), feedback = get("feedback");
  const heard = new Set(), failed = new Set();
  let tracks = [], scores = new Map(), current, listener;
  let loading, scoreTask, catalogAt = 0, scoresAt = 0, errors = 0, reported = false;

  function localRead(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function localWrite(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
  }

  function listenerKey() {
    if (!listener) {
      const stored = localRead("humkin.compost.listener");
      listener = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(stored || "")
        ? stored : makeListenerKey();
      localWrite("humkin.compost.listener", listener);
    }
    return listener;
  }

  function makeListenerKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  }

  async function request(query = "", options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint + query, {signal: controller.signal, ...options});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The archive is temporarily unavailable.");
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  function save(action, id, data = {}) {
    return request("", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({action, track_id: id, listener: listenerKey(), ...data})});
  }

  function receiveScores(rows) {
    scores = new Map(rows.map(row => [row.id, Number(row.plays)]));
    scoresAt = Date.now();
  }

  function loadCatalog() {
    if (loading) return loading;
    loading = request().then(data => {
      if (!data.tracks.length) throw new Error("The archive has no published recordings yet.");
      tracks = data.tracks;
      receiveScores(data.scores);
      catalogAt = Date.now();
      const available = new Set(tracks.map(track => track.id));
      for (const id of heard) if (!available.has(id)) heard.delete(id);
      if (!current) status.textContent = "Ready to play.";
      listen.textContent = "Listen to the Heap";
      get("count").textContent = tracks.length.toLocaleString() + " recordings";
    }).catch(error => {
      if (!tracks.length) {
        status.textContent = error.name === "AbortError" ? "The archive took too long to respond." : error.message;
        listen.textContent = "Retry loading";
      }
    }).finally(() => { loading = null; listen.disabled = false; });
    return loading;
  }

  function refreshScores() {
    if (Date.now() - catalogAt > 300000) return loadCatalog();
    if (scoreTask || Date.now() - scoresAt < 15000) return;
    scoreTask = request("?view=scores").then(data => receiveScores(data.scores))
      .catch(() => {}).finally(() => { scoreTask = null; });
  }

  function chooseTrack() {
    const available = tracks.filter(track => !failed.has(track.id));
    let choices = available.filter(track => !heard.has(track.id));
    if (!choices.length) {
      heard.clear();
      choices = available.length > 1 ? available.filter(track => track.id !== current?.id) : available;
    }
    let lowest = Infinity, ties = 0, selected;
    for (const track of choices) {
      const count = scores.get(track.id) ?? 0;
      if (count < lowest) {
        selected = track;
        lowest = count;
        ties = 1;
      } else if (count === lowest && Math.random() < 1 / ++ties) {
        selected = track;
      }
    }
    return selected;
  }

  function ratingKey(track) {
    return "humkin.compost.rating." + track.id;
  }

  function show(track) {
    get("cover").src = track.artwork;
    get("track").textContent = track.title;
    get("artist").textContent = [track.artist, track.album].filter(Boolean).join(" · ");
    get("current").hidden = false;
    form.reset();
    feedback.textContent = "";
    try {
      const saved = JSON.parse(localRead(ratingKey(track)) || "null");
      if (saved) {
        stars.value = saved.stars;
        reaction.value = saved.reaction || "";
        feedback.textContent = "Your rating is saved.";
      }
    } catch { /* An unreadable local rating can be replaced. */ }
    form.hidden = false;
    form.querySelector("button").disabled = false;
  }

  function tryAgain(message) {
    failed.clear();
    status.textContent = message;
    listen.hidden = false;
    next.hidden = true;
  }

  function playNext() {
    const track = chooseTrack();
    if (!track) return tryAgain("The archive audio could not load. Try listening again.");
    document.dispatchEvent(new Event("humkin:compost-playing"));
    current = track;
    reported = false;
    heard.add(track.id);
    show(track);
    listen.hidden = true;
    audio.hidden = false;
    next.hidden = false;
    status.textContent = "Loading recording…";
    audio.src = track.src;
    audio.play().catch(error => {
      if (current === track && error.name === "NotAllowedError")
        status.textContent = "Press play on the audio controls.";
    });
    refreshScores();
  }

  function reportPlay() {
    if (!current || reported) return;
    const ranges = audio.played;
    let seconds = 0;
    for (let i = 0; i < ranges.length; i++) seconds += ranges.end(i) - ranges.start(i);
    const duration = Number.isFinite(audio.duration) ? audio.duration : current.duration;
    if (seconds + 0.25 < Math.min(30, duration * 0.8)) return;
    reported = true;
    const track = current;
    scores.set(track.id, (scores.get(track.id) ?? 0) + 1);
    save("play", track.id).catch(() => {});
  }

  listen.addEventListener("click", () => {
    if (!tracks.length) {
      listen.disabled = true;
      status.textContent = "Loading published recordings…";
      loadCatalog();
      return;
    }
    errors = 0;
    playNext();
  });
  next.addEventListener("click", playNext);
  audio.addEventListener("playing", () => { errors = 0; status.textContent = ""; });
  audio.addEventListener("timeupdate", reportPlay);
  audio.addEventListener("ended", () => { reportPlay(); playNext(); });
  audio.addEventListener("error", () => {
    if (!current) return;
    failed.add(current.id);
    if (++errors < 3 && failed.size < tracks.length) playNext();
    else tryAgain("Several recordings could not load. Try listening again.");
  });
  document.addEventListener("humkin:station-one", () => audio.pause());

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!current) return;
    const track = current;
    const rating = {stars: Number(stars.value), reaction: reaction.value || null};
    const button = form.querySelector("button");
    button.disabled = true;
    feedback.textContent = "Saving…";
    try {
      await save("rate", track.id, rating);
      localWrite(ratingKey(track), JSON.stringify(rating));
      if (current === track) feedback.textContent = "Your rating is saved.";
    } catch (error) {
      if (current === track) feedback.textContent = error.message;
    } finally {
      if (current === track) button.disabled = false;
    }
  });

  loadCatalog();
})();
