import React, { useState } from "react";
import { User, ChevronDown, Plus, Check } from "lucide-react";
import CategoryToggle from "./CategoryToggle";
import Logo from "./Logo";

/**
 * Compact "who is this for" control. Most people on most devices only ever
 * have one profile — this stays a small, low-key pill until there's an
 * actual reason to notice it (a second person on the same phone), at
 * which point it's how they switch between separate, non-overlapping
 * intake/payment/report histories without one person's redo-intake ever
 * touching another's.
 */
function ProfileSwitcher({ profiles, activeSessionId, onSwitchProfile, onNewProfile }) {
  const [open, setOpen] = useState(false);
  const activeProfile = profiles.find((p) => p.session_id === activeSessionId);
  const label = activeProfile?.name || "This device";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium"
        style={{
          background: "rgba(92,122,90,0.08)",
          color: "#3A4F3A",
          border: "1px solid rgba(92,122,90,0.15)",
        }}
        data-testid="profile-switcher-btn"
      >
        <User size={12} />
        <span className="max-w-[100px] truncate">{label}</span>
        <ChevronDown
          size={12}
          style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1.5 w-60 rounded-xl bg-white border border-[#5C7A5A]/12 z-30 overflow-hidden"
            style={{ boxShadow: "0 20px 40px rgba(43,43,38,0.12)" }}
            data-testid="profile-switcher-menu"
          >
            {profiles.length > 1 && (
              <>
                <div className="px-3.5 pt-3 pb-1 text-[10px] tracking-wider uppercase text-ink/40">
                  Switch profile
                </div>
                <div className="py-1">
                  {profiles.map((p) => (
                    <button
                      key={p.session_id}
                      onClick={() => {
                        onSwitchProfile(p.session_id);
                        setOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] text-left hover:bg-black/[0.02]"
                      data-testid={`profile-option-${p.session_id}`}
                    >
                      <span className="truncate text-ink/85">{p.name || "Unnamed profile"}</span>
                      {p.session_id === activeSessionId && (
                        <Check size={13} style={{ color: "#3A4F3A" }} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="h-px bg-[#5C7A5A]/10 mx-3.5" />
              </>
            )}
            <button
              onClick={() => {
                onNewProfile();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3.5 py-3 text-[13px] font-medium text-left"
              style={{ color: "#B8632F" }}
              data-testid="new-profile-btn"
            >
              <Plus size={13} />
              Generate for someone else
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * App shell: header (wordmark + tagline + profile switcher + toggle) +
 * content area. Mobile-first, constrained max width, cream background.
 */
export default function AppShell({
  children,
  category,
  onCategoryChange,
  profiles = [],
  activeSessionId,
  onSwitchProfile,
  onNewProfile,
}) {
  return (
    <div className="app-bg grain relative">
      <div className="header-vignette" />
      <div className="mx-auto max-w-md w-full min-h-[100dvh] flex flex-col relative">
        <header
          className="sticky top-0 z-20 backdrop-blur-md no-print"
          style={{
            background: "rgba(250, 247, 240, 0.82)",
            borderBottom: "1px solid rgba(58,79,58,0.08)",
          }}
          data-testid="app-header"
        >
          <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-2">
                <Logo size={30} />
                {/* Wordmark */}
                <span
                  className="font-display text-[26px] font-medium tracking-tight text-ink"
                  data-testid="wordmark"
                >
                  Prakriti<span style={{ color: "#B8632F" }}>Dx</span>
                </span>
              </div>
              <span
                className="mt-1 text-[11px] font-medium tracking-[0.18em] uppercase"
                style={{ color: "#3A4F3A" }}
                data-testid="tagline"
              >
                Know Your Constitution
              </span>
              {onSwitchProfile && onNewProfile && (
                <div className="mt-2">
                  <ProfileSwitcher
                    profiles={profiles}
                    activeSessionId={activeSessionId}
                    onSwitchProfile={onSwitchProfile}
                    onNewProfile={onNewProfile}
                  />
                </div>
              )}
            </div>
            <div className="pt-1">
              <CategoryToggle value={category} onChange={onCategoryChange} />
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 pt-5 pb-safe relative" data-testid="app-main">
          {children}
        </main>

        <footer className="px-5 py-4 text-center no-print">
          <div className="text-[10px] tracking-wider uppercase text-ink/40">
            <span>Ayurveda + Modern Science · <span style={{ color: "#B8632F" }}>PrakritiDx</span></span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-[11.5px] font-semibold text-ink/60">
            <a href="/privacy.html" className="hover:text-ink">Privacy</a>
            <span className="text-ink/30">·</span>
            <a href="/terms.html" className="hover:text-ink">Terms</a>
            <span className="text-ink/30">·</span>
            <a href="/refund.html" className="hover:text-ink">Refunds</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
