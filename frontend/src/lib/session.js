// Session helpers — anonymous per-device identifier(s) stored in
// localStorage. Originally this was a single fixed session per browser;
// it now also tracks a small LIST of known profiles on the same device
// (e.g. a parent and a child sharing one phone), so someone can switch
// between them without one person's redo-intake ever overwriting
// another's paid report.
const ACTIVE_KEY = "prakritidx:session";
const PROFILES_KEY = "prakritidx:profiles";

function _newId() {
  return (
    "sess_" +
    (crypto?.randomUUID?.() ||
      Math.random().toString(36).slice(2) + Date.now().toString(36))
  );
}

function _readProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function _writeProfiles(list) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
  } catch {
    /* storage full/unavailable — profile list just won't persist this time */
  }
}

/** Adds a session id to the known-profiles list if it isn't already there,
 * and bumps its last-active time. Safe to call every time a session
 * becomes active, including ones that already existed before this
 * multi-profile system was added — they get picked up automatically. */
function _touchProfile(sessionId, nameUpdate) {
  const list = _readProfiles();
  const existing = list.find((p) => p.session_id === sessionId);
  const now = new Date().toISOString();
  if (existing) {
    existing.last_active = now;
    if (nameUpdate) existing.name = nameUpdate;
  } else {
    list.push({ session_id: sessionId, name: nameUpdate || null, last_active: now });
  }
  _writeProfiles(list);
}

export function getOrCreateSessionId() {
  try {
    // A restore link (from the "email me my report" recovery flow) takes
    // priority — it re-seeds this exact session id on a brand new
    // device/browser, so tapping the link is what lets someone regain
    // access to an already-paid, already-generated report elsewhere.
    const params = new URLSearchParams(window.location.search);
    const restoreId = params.get("restore");
    if (restoreId) {
      localStorage.setItem(ACTIVE_KEY, restoreId);
      // Clean the URL so refreshing or re-sharing it doesn't keep
      // re-triggering the restore, and the id isn't left sitting in the bar.
      params.delete("restore");
      const clean =
        window.location.pathname +
        (params.toString() ? `?${params}` : "") +
        window.location.hash;
      window.history.replaceState({}, "", clean);
      _touchProfile(restoreId);
      return restoreId;
    }

    let id = localStorage.getItem(ACTIVE_KEY);
    if (!id) {
      id = _newId();
      localStorage.setItem(ACTIVE_KEY, id);
    }
    _touchProfile(id);
    return id;
  } catch {
    return _newId();
  }
}

/** The currently active session id, without touching the profile list or
 * checking for a restore link — for use after initial app load. */
export function getActiveSessionId() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** All known profiles on this device, most recently active first. */
export function getProfiles() {
  return _readProfiles().sort(
    (a, b) => new Date(b.last_active) - new Date(a.last_active)
  );
}

/** Switches the active session to an existing profile on this device. */
export function setActiveSession(sessionId) {
  try {
    localStorage.setItem(ACTIVE_KEY, sessionId);
  } catch {
    /* storage unavailable — the id is still returned so the caller can
       hold it in memory for this visit even if it won't persist */
  }
  _touchProfile(sessionId);
}

/** Starts a brand-new, empty profile on this device — for a different
 * person using the same phone/browser — and makes it the active one. */
export function createNewProfile() {
  const id = _newId();
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* non-fatal */
  }
  _touchProfile(id);
  return id;
}

/** Called once we learn a profile's name (from intake or a report), so
 * the switcher can show "Priya" instead of a bare, anonymous id. */
export function updateProfileName(sessionId, name) {
  if (!name) return;
  _touchProfile(sessionId, name);
}
