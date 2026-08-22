import React from "react";

const DOSHA_COLORS = {
  vata: "#8B7BAA",
  pitta: "#B8632F",
  kapha: "#5C7A5A",
};

const ORDER = ["vata", "pitta", "kapha"];

/**
 * DoshaDial — a radial Vata/Pitta/Kapha percentage ring, echoing the seal
 * logo's concentric dial-ring motif. Replaces the old single-letter badge:
 * real Ayurvedic constitution is usually a blend of two or three doshas,
 * so this shows the actual breakdown instead of just the winner.
 *
 * `breakdown` — {vata, pitta, kapha} percentages summing to 100.
 * Falls back to an even split if breakdown is missing (e.g. an older
 * cached report generated before this field existed).
 *
 * Used identically on both the free hook and the paid report — the real
 * breakdown IS the promised free feature. The hook on the free side comes
 * from the percentage-driven insight line rendered alongside it (see
 * getDoshaInsight below), not from withholding the dial itself.
 */
export default function DoshaDial({ breakdown, dominant, dominantLabel, size = 148 }) {
  const pct = breakdown || { vata: 34, pitta: 33, kapha: 33 };
  const r = 42;
  const gap = 2.2; // degrees of gap between arc segments, for visual separation

  const polarToCartesian = (cx, cy, radius, angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const describeArc = (cx, cy, radius, startDeg, sweepDeg) => {
    if (sweepDeg <= 0) return "";
    const endDeg = startDeg + sweepDeg;
    const start = polarToCartesian(cx, cy, radius, startDeg);
    const end = polarToCartesian(cx, cy, radius, endDeg);
    const largeArc = sweepDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  const cx = 50, cy = 50;

  let cumulativeDeg = -90; // start at 12 o'clock
  const arcs = ORDER.map((dosha) => {
    const value = pct[dosha] || 0;
    const deg = (value / 100) * 360;
    const arc = {
      dosha,
      color: DOSHA_COLORS[dosha],
      value,
      startDeg: cumulativeDeg + gap / 2,
      sweepDeg: Math.max(deg - gap, 0),
    };
    cumulativeDeg += deg;
    return arc;
  });

  return (
    <div className="flex flex-col items-center" data-testid="dosha-dial">
      <div className="relative" style={{ width: size, height: size }}>
        {/* soft ambient glow behind the dial, matching the seal treatment */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${DOSHA_COLORS[dominant] || "#5C7A5A"}33 0%, transparent 68%)`,
            filter: "blur(4px)",
          }}
        />
        <svg viewBox="0 0 100 100" width={size} height={size} className="relative">
          {/* faint track ring underneath, echoing the seal's dial lines */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(43,43,38,0.06)" strokeWidth="9" />
          {arcs.map((a) => (
            <path
              key={a.dosha}
              d={describeArc(cx, cy, r, a.startDeg, a.sweepDeg)}
              fill="none"
              stroke={a.color}
              strokeWidth="9"
              strokeLinecap="round"
              opacity={a.dosha === dominant ? 1 : 0.55}
            />
          ))}
          {/* thin gold ring, echoing the seal logo */}
          <circle cx={cx} cy={cy} r={r + 7} fill="none" stroke="#D9A441" strokeWidth="0.5" opacity="0.4" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[26px] leading-none text-ink" data-testid="dosha-dial-pct">
            {pct[dominant] ?? "--"}%
          </span>
          <span className="text-[10px] tracking-widest uppercase text-ink/50 mt-1">
            {dominantLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4" data-testid="dosha-dial-legend">
        {ORDER.map((dosha) => (
          <div key={dosha} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: DOSHA_COLORS[dosha] }}
            />
            <span className="text-[11px] text-ink/60 capitalize">
              {dosha} <span className="text-ink/40">{pct[dosha] ?? 0}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Percentage-driven hook copy -------------------------------------------

const TRAITS = {
  skin: {
    vata: "dryness and sensitivity that shifts with weather and stress",
    pitta: "heat, redness, and reactivity that spikes under pressure",
    kapha: "congestion and oil buildup that responds slowly to change",
  },
  hair: {
    vata: "brittleness and frizz that worsens with irregular routines",
    pitta: "thinning and heat-triggered shedding",
    kapha: "oiliness and buildup that dulls shine fast",
  },
};

const cap = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * Builds a short, percentage-specific sentence naming the dominant AND
 * second-highest dosha by their actual numbers and traits, explains why
 * that combination is easy to get wrong with generic advice, then names
 * the concrete deliverables sitting behind the unlock. This is the "hook"
 * for the free read — not withholding the dial, but making its real data
 * feel like it demands a next step.
 */
export function getDoshaInsight(category, breakdown, dominant) {
  const pct = breakdown || { vata: 34, pitta: 33, kapha: 33 };
  const ordered = ORDER.slice().sort((a, b) => (pct[b] || 0) - (pct[a] || 0));
  const secondary = ordered.find((d) => d !== dominant) || ordered[1];
  const traits = TRAITS[category] || TRAITS.skin;

  return (
    `Your ${category} leans ${pct[dominant] ?? 0}% ${cap(dominant)} with a real ${pct[secondary] ?? 0}% ${cap(secondary)} undertone — ` +
    `${traits[dominant]}, pulling against ${traits[secondary]} beneath it. Most routines target one dosha and ignore the other, ` +
    `which is often exactly why generic advice hasn't worked for you. Unlock your full report for the exact morning-to-evening ` +
    `routine, ingredients, and diet built to work with both — not just one.`
  );
}
