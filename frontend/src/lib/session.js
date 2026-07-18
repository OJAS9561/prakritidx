// Session helpers — anonymous per-device identifier stored in localStorage.
const KEY = "prakritidx:session";

export function getOrCreateSessionId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        "sess_" +
        (crypto?.randomUUID?.() ||
          Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "sess_" + Math.random().toString(36).slice(2);
  }
}
