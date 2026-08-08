import React, { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

const DISMISS_KEY = "prakritidx:install-dismissed-at";
const DISMISS_DAYS = 14;

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function wasRecentlyDismissed() {
  try {
    const at = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
    if (!at) return false;
    const days = (Date.now() - at) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  } catch {
    return false;
  }
}

/**
 * Slim install banner. On Android/desktop Chrome it uses the native
 * beforeinstallprompt flow via a real button. On iOS Safari (which has no
 * such API) it shows a one-line "Add to Home Screen" hint instead.
 * Stays hidden if already installed/standalone, or recently dismissed.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    if (isIOS()) {
      setShowIOSHint(true);
      setVisible(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-30 mx-auto max-w-md"
      data-testid="install-prompt"
    >
      <div
        className="rounded-2xl bg-white p-4 border border-[#5C7A5A]/15 shadow-lift flex items-center gap-3"
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(92,122,90,0.1)", color: "#3A4F3A" }}
        >
          {showIOSHint ? <Share size={16} /> : <Download size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] text-ink font-medium leading-snug">
            {showIOSHint
              ? "Add PrakritiDx to your Home Screen"
              : "Install PrakritiDx"}
          </div>
          <div className="text-[11.5px] text-ink/55 mt-0.5 leading-snug">
            {showIOSHint
              ? "Tap Share, then \u201cAdd to Home Screen\u201d"
              : "Quick access, works like an app"}
          </div>
        </div>
        {!showIOSHint && (
          <button
            onClick={install}
            className="btn-primary flex-shrink-0 px-3 py-2 text-[13px]"
            data-testid="install-btn"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-ink/40 hover:bg-black/5"
          aria-label="Dismiss"
          data-testid="install-dismiss-btn"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
