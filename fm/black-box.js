/* HUMKIN Station Desk 0.3: a bounded, voluntary local receiver flight recorder.
 * No telemetry, cookies, personal identifiers, raw URLs or automatic uploads. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HUMKIN_BLACK_BOX = api.createRecorder();
})(typeof window === "undefined" ? null : window, function (root) {
  "use strict";
  const EVENTS = new Set([
    "boot_ready", "boot_error", "mode_change", "source_select",
    "play", "playing", "pause", "boundary", "audio_error",
    "play_rejected", "stalled", "waiting", "report_signal"
  ]);
  const MODES = new Set(["clock", "shuffle", "album", "stream"]);
  const FIELDS = ["track_id", "next_track_id", "mode", "kind", "reason",
                  "cycle", "position_s", "duration_s", "song_count",
                  "bumper_count", "audio_code", "clock_calibrated"];
  const REASONS = new Set(["native_ended", "near_end", "watchdog", "mode_change",
    "tune_in", "manual", "automatic", "source_error", "blocked", "unknown"]);
  const KIND = new Set(["song", "bumper", "stream"]);
  function safeDetail(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const clean = {};
    for (const field of FIELDS) {
      const value = source[field];
      if (field === "track_id" || field === "next_track_id") {
        if (typeof value === "string" && /^[a-zA-Z0-9_-]{1,96}$/.test(value))
          clean[field] = value;
      } else if (field === "mode" && MODES.has(value)) clean[field] = value;
      else if (field === "kind" && KIND.has(value)) clean[field] = value;
      else if (field === "reason" && REASONS.has(value)) clean[field] = value;
      else if (field === "clock_calibrated" && typeof value === "boolean")
        clean[field] = value;
      else if (field === "audio_code" && Number.isInteger(value) && value >= 0 && value <= 4)
        clean[field] = value;
      else if (["cycle", "song_count", "bumper_count"].includes(field) &&
               Number.isSafeInteger(value) && value >= 0 && value < 100000000)
        clean[field] = value;
      else if (["position_s", "duration_s"].includes(field) &&
               typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 14400)
        clean[field] = Math.round(value * 10) / 10;
    }
    return clean;
  }
  function createRecorder(options = {}) {
    const maxEvents = Number.isSafeInteger(options.maxEvents)
      ? Math.max(1, Math.min(256, options.maxEvents)) : 160;
    const now = typeof options.now === "function" ? options.now : () => new Date().toISOString();
    let events = [];
    function record(event, detail) {
      if (!EVENTS.has(event)) return false;
      const item = {at: String(now()), event, ...safeDetail(detail)};
      events.push(item);
      if (events.length > maxEvents) events.splice(0, events.length - maxEvents);
      return true;
    }
    function report() {
      const counts = {};
      for (const entry of events) counts[entry.event] = (counts[entry.event] || 0) + 1;
      return {
        schema: "humkin.radio.blackbox/v1", source: "browser",
        generated_at: String(now()), event_count: events.length,
        counts, events: events.map(e => ({...e})),
        note: "User-exported, bounded receiver events. No sound recording or automatic transmission."
      };
    }
    function download() {
      if (!root || !root.document || !root.URL ||
          typeof root.URL.createObjectURL !== "function") return false;
      const file = new root.Blob([JSON.stringify(report(), null, 2) + "\n"],
        {type: "application/json"});
      const url = root.URL.createObjectURL(file);
      const link = root.document.createElement("a");
      link.href = url; link.download = "humkin-signal-report.json";
      root.document.body.appendChild(link);
      try { link.click(); } finally {
        link.remove();
        // Allow downloads to start before releasing the object URL.
        root.setTimeout(() => root.URL.revokeObjectURL(url), 30000);
      }
      return true;
    }
    return Object.freeze({record, report, download});
  }
  return Object.freeze({createRecorder, safeDetail});
});
