// Session helpers — anonymous per-device identifier stored in localStorage.
const KEY = "prakritidx:session";

export function getOrCreateSessionId() {
  try {
    // A restore link (from the "email me my report" recovery flow) takes
    // priority — it re-seeds this exact session id on a brand new
    // device/browser, so tapping the link is what lets someone regain
    // access to an already-paid, already-generated report elsewhere.
    const params = new URLSearchParams(window.location.search);
    const restoreId = params.get("restore");
    if (restoreId) {
      localStorage.setItem(KEY, restoreId);
      // Clean the URL so refreshing or re-sharing it doesn't keep
      // re-triggering the restore, and the id isn't left sitting in the bar.
      params.delete("restore");
      const clean =
        window.location.pathname +
        (params.toString() ? `?${params}` : "") +
        window.location.hash;
      window.history.replaceState({}, "", clean);
      return restoreId;
    }

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
