// HUMKIN owner session bridge for older Mac Chromium browsers.
//
// Some older Chromium builds reject navigator.locks.request() with
// DOMException: "The request was denied" when site storage is restricted.
// Supabase Auth 2.57 uses Web Locks by default. Keep single-tab auth work
// serialized without asking the browser for Web Locks permissions.
//
// This is NOT an authentication bypass: Supabase still validates all JWTs,
// refresh tokens, owner identities, and the signed Proton OTP exchange.
const pending = new Map();

export async function humkinAuthLock(name, _timeout, work) {
  const prior = pending.get(name) || Promise.resolve();
  let release;
  const finished = new Promise(resolve => { release = resolve; });
  const tail = prior.catch(() => {}).then(() => finished);
  pending.set(name, tail);
  try {
    await prior.catch(() => {});
    return await work();
  } finally {
    release();
    if (pending.get(name) === tail) pending.delete(name);
  }
}
const mem = new Map();

function chooseStore() {
  if (typeof window === "undefined") return {mode: "memory", store: null};
  for (const name of ["localStorage", "sessionStorage"]) {
    try {
      const storage = window[name];
      const testKey = "__humkin_session_probe__";
      storage.setItem(testKey, "1");
      if (storage.getItem(testKey) !== "1") continue;
      storage.removeItem(testKey);
      return {mode: name, store: storage};
    } catch {
      // The browser may reject localStorage or sessionStorage independently.
    }
  }
  return {mode: "memory", store: null};
}

const chosen = chooseStore();

export function sessionStorageMode() { return chosen.mode; }

export const humkinAuthStorage = {
  getItem(key) {
    if (chosen.store) {
      try { return chosen.store.getItem(key); }
      catch { /* Fall back only for this browser tab. */ }
    }
    return mem.get(key) ?? null;
  },
  setItem(key, value) {
    if (chosen.store) {
      try { chosen.store.setItem(key, value); return; }
      catch { /* Site storage disallowed; keep session in page memory. */ }
    }
    mem.set(key, value);
  },
  removeItem(key) {
    if (chosen.store) {
      try { chosen.store.removeItem(key); }
      catch { /* Continue clearing in-memory state. */ }
    }
    mem.delete(key);
  }
};

export function humkinAuthOptions() {
  return {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: humkinAuthStorage,
    lock: humkinAuthLock
  };
}
