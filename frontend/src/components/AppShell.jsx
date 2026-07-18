import React from "react";
import CategoryToggle from "./CategoryToggle";

/**
 * App shell: header (wordmark + tagline + toggle) + content area.
 * Mobile-first, constrained max width, cream background.
 */
export default function AppShell({ children, category, onCategoryChange }) {
  return (
    <div className="app-bg grain relative">
      <div className="mx-auto max-w-md w-full min-h-[100dvh] flex flex-col">
        <header
          className="sticky top-0 z-20 backdrop-blur-md"
          style={{
            background: "rgba(250, 247, 240, 0.82)",
            borderBottom: "1px solid rgba(58,79,58,0.08)",
          }}
          data-testid="app-header"
        >
          <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-2">
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
            </div>
            <div className="pt-1">
              <CategoryToggle value={category} onChange={onCategoryChange} />
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 pt-5 pb-safe relative" data-testid="app-main">
          {children}
        </main>

        <footer className="px-5 py-4 text-[10px] tracking-wider uppercase text-ink/40 text-center">
          <span>Ayurveda · Modern Science · <span style={{ color: "#B8632F" }}>PrakritiDx</span></span>
        </footer>
      </div>
    </div>
  );
}
