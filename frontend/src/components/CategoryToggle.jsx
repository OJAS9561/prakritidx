import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * Pill-shaped Skin/Hair toggle with sliding thumb (Framer Motion layoutId).
 */
export default function CategoryToggle({ value, onChange }) {
  const options = [
    { key: "skin", label: "Skin" },
    { key: "hair", label: "Hair" },
  ];

  return (
    <div
      className="pill-track"
      role="tablist"
      aria-label="Choose Skin or Hair"
      data-testid="category-toggle"
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            data-testid={`toggle-${opt.key}`}
            className="relative z-10 px-6 py-2 text-sm font-medium tracking-wide focus:outline-none"
            style={{ color: active ? "#FAF7F0" : "#3A4F3A", minWidth: 86 }}
          >
            {active && (
              <motion.span
                layoutId="pill-thumb"
                className="pill-thumb"
                style={{ left: 4, right: 4 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative flex items-center justify-center gap-1.5">
              {active && <Sparkles size={12} className="opacity-80" />}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
