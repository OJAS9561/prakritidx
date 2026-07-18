import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, Sunrise, Moon, CalendarDays, Leaf, Ban, Check, X as XIcon, Sparkles } from "lucide-react";
import { getRecommendations, getIngredients } from "../lib/api";

const TIME_ICON = {
  Morning: Sunrise,
  Evening: Moon,
  Weekly: CalendarDays,
};

/**
 * Recommendations screen — AI-personalized routine + curated library.
 * Same component for skin & hair, parameterized by category.
 */
export default function Recommendations({ category, sessionId, result, onBack, onRestart }) {
  const [rec, setRec] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRec(null);

    Promise.all([
      getRecommendations({
        session_id: sessionId,
        category,
        primary_dosha: result.primary_dosha,
        secondary_dosha: result.secondary_dosha || null,
      }),
      getIngredients(category, result.primary_dosha),
    ])
      .then(([r, i]) => {
        if (cancelled) return;
        setRec(r);
        setIngredients(i.items || []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your personalized routine. Please try again.");
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [sessionId, category, result.primary_dosha, result.secondary_dosha]);

  return (
    <div className="pb-10" data-testid={`recommendations-${category}`}>
      {/* Top nav */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#5C7A5A]/15 text-ink/70 hover:bg-white transition-colors"
          data-testid="rec-back-btn"
          aria-label="Back to result"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="eyebrow">Your {category} Routine</span>
        <button
          onClick={onRestart}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#5C7A5A]/15 text-ink/60 hover:bg-white transition-colors"
          data-testid="rec-restart-btn"
          aria-label="Start over"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-[32px] leading-tight tracking-tight text-ink">
          For your <span style={{ color: "#B8632F" }}>{result.dosha_label}</span>{" "}
          {category}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <Sparkles size={12} style={{ color: "#D9A441" }} />
          <span className="text-[11px] tracking-widest uppercase text-ink/60">
            AI-personalized · Ayurveda × Modern Science
          </span>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center" data-testid="rec-loading">
          <div className="inline-block w-8 h-8 rounded-full border-2 border-[#5C7A5A] border-t-transparent animate-spin" />
          <div className="mt-4 text-sm text-ink/60">
            Crafting your Ayurvedic routine…
          </div>
        </div>
      )}

      {error && (
        <div className="py-16 text-center" data-testid="rec-error">
          <div className="text-ink/80 mb-4">{error}</div>
          <button className="btn-ghost" onClick={onBack}>Back</button>
        </div>
      )}

      {rec && (
        <>
          {/* Summary card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl bg-white p-6 border border-[#5C7A5A]/10 shadow-soft mb-8"
            data-testid="rec-summary"
          >
            <span className="eyebrow">Overview</span>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/85">
              {rec.summary}
            </p>
          </motion.div>

          {/* Routine */}
          <SectionTitle
            title="Your Daily Rhythm"
            subtitle="A rhythm shaped by your prakriti"
          />
          <div className="space-y-3 mt-4">
            {rec.routine.map((step, i) => {
              const Icon = TIME_ICON[step.time] || Sunrise;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="rounded-2xl bg-white p-5 border border-[#5C7A5A]/10 shadow-soft card-lift flex gap-4"
                  data-testid={`routine-step-${i}`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(92,122,90,0.08)", color: "#3A4F3A" }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] tracking-widest uppercase text-ink/50 mb-1">
                      {step.time}
                    </div>
                    <div className="font-display text-[17px] text-ink leading-snug">
                      {step.step}
                    </div>
                    <div className="text-[13px] text-ink/60 mt-1.5 leading-relaxed">
                      {step.why}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Key ingredients */}
          <SectionTitle
            title="Key Ingredients For You"
            subtitle="AI-selected for your dosha"
            className="mt-10"
          />
          <div className="grid grid-cols-1 gap-3 mt-4">
            {rec.key_ingredients.map((ing, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white p-4 border border-[#5C7A5A]/10 shadow-soft flex items-start gap-3"
                data-testid={`ingredient-${i}`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(217,164,65,0.12)", color: "#B8632F" }}
                >
                  <Leaf size={14} />
                </div>
                <div className="flex-1">
                  <div className="font-display text-[16px] text-ink leading-tight">
                    {ing.name}
                  </div>
                  <div className="text-[13px] text-ink/60 mt-1 leading-relaxed">
                    {ing.role}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Do / Don't */}
          <div className="grid grid-cols-2 gap-3 mt-10">
            <ListCard
              title="Do"
              items={rec.do}
              icon={Check}
              tint="#5C7A5A"
              testId="do-list"
            />
            <ListCard
              title="Don't"
              items={rec.dont}
              icon={XIcon}
              tint="#B8632F"
              testId="dont-list"
            />
          </div>

          {/* Avoid list */}
          {rec.avoid?.length > 0 && (
            <>
              <SectionTitle
                title="Ingredients to Avoid"
                subtitle="For your dosha specifically"
                className="mt-10"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {rec.avoid.map((a, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] bg-white border border-[#B8632F]/20 text-ink/80"
                    data-testid={`avoid-${i}`}
                  >
                    <Ban size={12} style={{ color: "#B8632F" }} />
                    {a}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Herbs */}
          {rec.herbs?.length > 0 && (
            <>
              <SectionTitle
                title="Ayurvedic Herbs"
                subtitle="How to bring them into your day"
                className="mt-10"
              />
              <div className="mt-4 space-y-3">
                {rec.herbs.map((h, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-white p-5 border border-[#5C7A5A]/10 shadow-soft"
                    data-testid={`herb-${i}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[17px] text-ink">{h.name}</span>
                      <span
                        className="text-[10px] tracking-widest uppercase gold-underline"
                        style={{ color: "#B8632F" }}
                      >
                        Herb
                      </span>
                    </div>
                    <p className="text-[13px] text-ink/70 mt-2 leading-relaxed">
                      {h.usage}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Curated library */}
          {ingredients.length > 0 && (
            <>
              <SectionTitle
                title="Curated Library"
                subtitle="Classical ingredients for this dosha"
                className="mt-10"
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {ingredients.map((ing, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-white p-4 border border-[#5C7A5A]/10 shadow-soft"
                    data-testid={`library-${i}`}
                  >
                    <div className="font-display text-[15px] text-ink leading-tight">
                      {ing.name}
                    </div>
                    <div className="text-[10px] tracking-widest uppercase text-ink/40 mt-1">
                      {ing.sanskrit}
                    </div>
                    <div className="text-[12px] text-ink/65 mt-2 leading-relaxed">
                      {ing.benefit}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-12 text-center">
            <div className="gold-divider mb-6" />
            <p className="text-xs text-ink/50 leading-relaxed max-w-[280px] mx-auto">
              Guidance is educational and not a substitute for medical advice.
              Patch-test new ingredients.
            </p>
            <button
              onClick={onRestart}
              className="btn-ghost justify-center mt-6"
              data-testid="rec-start-over-btn"
            >
              <RotateCcw size={14} />
              Start over
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitle({ title, subtitle, className = "" }) {
  return (
    <div className={className}>
      <span className="eyebrow">{title}</span>
      <div className="font-display text-[22px] text-ink leading-tight mt-1">
        {subtitle}
      </div>
    </div>
  );
}

function ListCard({ title, items, icon: Icon, tint, testId }) {
  return (
    <div
      className="rounded-2xl bg-white p-5 border border-[#5C7A5A]/10 shadow-soft"
      data-testid={testId}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: `${tint}18`, color: tint }}
        >
          <Icon size={12} />
        </div>
        <span className="font-display text-[16px] text-ink">{title}</span>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li
            key={i}
            className="text-[13px] text-ink/75 leading-relaxed flex gap-2"
            data-testid={`${testId}-item-${i}`}
          >
            <span style={{ color: tint }}>·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
