import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, RotateCcw } from "lucide-react";

const DOSHA_COLORS = {
  vata: "#8B7BAA",
  pitta: "#B8632F",
  kapha: "#5C7A5A",
};

const DOSHA_META = {
  vata: {
    element: "Air & Space",
    quality: "Dry · Light · Cool · Mobile",
    tagline_skin: "Skin that runs dry, delicate, and sensitive to the elements.",
    tagline_hair: "Hair that runs dry, fine, and prone to frizz & breakage.",
  },
  pitta: {
    element: "Fire & Water",
    quality: "Hot · Sharp · Oily · Intense",
    tagline_skin: "Skin that flushes fast, breaks out under heat, and craves calm.",
    tagline_hair: "Hair that greys early, thins under stress, and needs cooling care.",
  },
  kapha: {
    element: "Earth & Water",
    quality: "Heavy · Cool · Oily · Stable",
    tagline_skin: "Skin that stays supple but leans oily, dense, and congested.",
    tagline_hair: "Hair that's thick and strong but heavy and greasy at the roots.",
  },
};

/**
 * Result screen — same for skin & hair, just re-parameterized copy.
 */
export default function ResultsScreen({ category, result, onSeeRoutine, onRetake }) {
  const primary = result.primary_dosha;
  const meta = DOSHA_META[primary];
  const totalAnswers =
    result.scores.vata + result.scores.pitta + result.scores.kapha;

  return (
    <div className="pb-8" data-testid={`result-${category}`}>
      <div className="text-center pt-4">
        <span className="eyebrow" data-testid="result-eyebrow">
          Your {category} Prakriti
        </span>
      </div>

      {/* Dosha crest */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-6 mx-auto flex flex-col items-center"
      >
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center shadow-lift relative"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${DOSHA_COLORS[primary]}, ${DOSHA_COLORS[primary]}CC)`,
          }}
        >
          <span className="font-display text-[54px] text-white leading-none">
            {primary[0].toUpperCase()}
          </span>
          <div
            className="absolute -bottom-2 px-3 py-1 rounded-full text-[10px] font-medium tracking-widest uppercase text-white shadow-soft"
            style={{ background: "#D9A441" }}
          >
            Primary
          </div>
        </div>

        <h1
          className="font-display text-[42px] leading-tight tracking-tight text-ink mt-8"
          data-testid="dosha-label"
        >
          {result.dosha_label}
        </h1>
        <div className="mt-2 text-sm text-ink/60">
          {meta.element} · {meta.quality}
        </div>
      </motion.div>

      <div className="gold-divider my-8" />

      <p
        className="font-display text-[20px] leading-snug text-ink text-center"
        data-testid="result-tagline"
      >
        {category === "skin" ? meta.tagline_skin : meta.tagline_hair}
      </p>

      {/* Score breakdown */}
      <div className="mt-8">
        <span className="eyebrow">Your Dosha Balance</span>
        <div className="mt-4 space-y-3">
          {["vata", "pitta", "kapha"].map((d) => {
            const pct = totalAnswers ? (result.scores[d] / totalAnswers) * 100 : 0;
            return (
              <div key={d} data-testid={`score-${d}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-ink capitalize">{d}</span>
                  <span className="text-xs text-ink/50 font-medium tabular-nums">
                    {result.scores[d]} · {Math.round(pct)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#3A4F3A]/8 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                    className="h-full rounded-full"
                    style={{ background: DOSHA_COLORS[d] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {result.secondary_dosha && (
        <div
          className="mt-8 p-5 rounded-2xl border border-[#5C7A5A]/12 bg-white shadow-soft"
          data-testid="dual-dosha-note"
        >
          <span className="eyebrow">Dual Constitution</span>
          <p className="mt-2 text-sm text-ink/75 leading-relaxed">
            Your secondary dosha is{" "}
            <span className="font-medium text-ink capitalize">
              {result.secondary_dosha}
            </span>
            . Your routine will balance both — this is common and gives you a nuanced
            regimen.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-10 flex flex-col gap-3">
        <button
          onClick={onSeeRoutine}
          className="btn-primary justify-center"
          data-testid="see-routine-btn"
        >
          See my personalized routine
          <ArrowRight size={16} />
        </button>
        <button
          onClick={onRetake}
          className="btn-ghost justify-center"
          data-testid="retake-quiz-btn"
        >
          <RotateCcw size={14} />
          Retake the {category} quiz
        </button>
      </div>
    </div>
  );
}
