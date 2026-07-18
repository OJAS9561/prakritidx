import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sunrise,
  Moon,
  CalendarDays,
  Leaf,
  Ban,
  Sparkles,
  Camera,
  FileText,
  Utensils,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { getFullReport } from "../lib/api";

const TIME_ICON = { Morning: Sunrise, Evening: Moon, Weekly: CalendarDays };
const DOSHA_COLORS = { vata: "#8B7BAA", pitta: "#B8632F", kapha: "#5C7A5A" };

/**
 * Full paid report — vision-augmented, personalized.
 */
export default function FullReport({ category, sessionId, onRestart, onSwitchCategory, unlockedMap }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReport(null);
    getFullReport({ session_id: sessionId, category })
      .then((r) => !cancelled && setReport(r))
      .catch((e) => {
        if (cancelled) return;
        const detail = e?.response?.data?.detail || "";
        setError(
          e?.response?.status === 402
            ? "This report is locked until payment is confirmed."
            : detail || "Could not generate your report."
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sessionId, category]);

  if (loading) {
    return (
      <div className="py-24 text-center" data-testid="report-loading">
        <div className="inline-block w-8 h-8 rounded-full border-2 border-[#5C7A5A] border-t-transparent animate-spin" />
        <div className="mt-4 text-sm text-ink/60">
          Crafting your personalized {category} report…
        </div>
        <div className="mt-1 text-[11px] text-ink/40">This can take 20–40 seconds.</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="py-24 text-center" data-testid="report-error">
        <div className="text-ink/80 mb-4">{error}</div>
        <button className="btn-ghost" onClick={onRestart}>
          Start over
        </button>
      </div>
    );
  }

  const doshaColor = DOSHA_COLORS[report.dosha] || "#5C7A5A";
  const otherCat = category === "skin" ? "hair" : "skin";
  const otherUnlocked = unlockedMap?.[otherCat];

  return (
    <div className="pb-10" data-testid={`report-${category}`}>
      {/* Header */}
      <div className="text-center pt-2">
        <span className="eyebrow">Your full {category} report</span>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mt-6 mx-auto flex flex-col items-center"
      >
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center shadow-lift relative"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${doshaColor}, ${doshaColor}CC)`,
          }}
        >
          <span className="font-display text-[46px] text-white leading-none">
            {report.dosha_label?.[0]}
          </span>
          <div
            className="absolute -bottom-2 px-3 py-1 rounded-full text-[10px] font-medium tracking-widest uppercase text-ink shadow-soft"
            style={{ background: "#D9A441" }}
            data-testid="report-unlocked-badge"
          >
            Unlocked
          </div>
        </div>
        <h1 className="font-display text-[36px] leading-tight tracking-tight text-ink mt-8" data-testid="report-dosha">
          {report.dosha_label}-leaning
        </h1>
      </motion.div>

      <div className="gold-divider my-7" />

      {/* Constitution read */}
      <Card testId="report-constitution">
        <Eyebrow>Your Constitution</Eyebrow>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/85">
          {report.constitution_read}
        </p>
      </Card>

      {/* Vision & lab notes */}
      {(report.vision_notes || report.lab_notes) && (
        <div className="grid grid-cols-1 gap-3 mt-4">
          {report.vision_notes && (
            <Card testId="report-vision">
              <div className="flex items-center gap-2">
                <Camera size={14} style={{ color: "#B8632F" }} />
                <Eyebrow>Selfie observations</Eyebrow>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/80">
                {report.vision_notes}
              </p>
            </Card>
          )}
          {report.lab_notes && (
            <Card testId="report-lab">
              <div className="flex items-center gap-2">
                <FileText size={14} style={{ color: "#B8632F" }} />
                <Eyebrow>Lab report signals</Eyebrow>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/80">
                {report.lab_notes}
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Routine */}
      <SectionHeader title="Your Daily Rhythm" subtitle="Precisely tuned for you" />
      <div className="space-y-3 mt-4">
        {report.routine?.map((s, i) => {
          const Icon = TIME_ICON[s.time] || Sunrise;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              className="rounded-2xl bg-white p-5 border border-[#5C7A5A]/10 shadow-soft flex gap-4"
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
                  {s.time}
                </div>
                <div className="font-display text-[17px] text-ink leading-snug">
                  {s.step}
                </div>
                <div className="text-[13px] text-ink/60 mt-1.5 leading-relaxed">
                  {s.why}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Key ingredients */}
      <SectionHeader title="Key Ingredients" subtitle="Ayurvedic + modern" className="mt-10" />
      <div className="mt-4 space-y-3">
        {report.key_ingredients?.map((ing, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white p-4 border border-[#5C7A5A]/10 shadow-soft flex gap-3"
            data-testid={`ingredient-${i}`}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(217,164,65,0.14)", color: "#B8632F" }}
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

      {/* Diet */}
      {report.diet && (
        <>
          <SectionHeader
            title="Diet"
            subtitle="What to favour and reduce"
            className="mt-10"
          />
          <div className="grid grid-cols-1 gap-3 mt-4">
            <Card testId="diet-favor">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(92,122,90,0.15)", color: "#3A4F3A" }}
                >
                  <Utensils size={12} />
                </div>
                <span className="font-display text-[16px] text-ink">Favour</span>
              </div>
              <ul className="space-y-1.5">
                {report.diet.favor?.map((f, i) => (
                  <li
                    key={i}
                    className="text-[13.5px] text-ink/80 leading-relaxed flex gap-2"
                    data-testid={`diet-favor-${i}`}
                  >
                    <span style={{ color: "#5C7A5A" }}>·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card testId="diet-reduce">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(184,99,47,0.15)", color: "#B8632F" }}
                >
                  <Ban size={12} />
                </div>
                <span className="font-display text-[16px] text-ink">Reduce</span>
              </div>
              <ul className="space-y-1.5">
                {report.diet.reduce?.map((f, i) => (
                  <li
                    key={i}
                    className="text-[13.5px] text-ink/80 leading-relaxed flex gap-2"
                    data-testid={`diet-reduce-${i}`}
                  >
                    <span style={{ color: "#B8632F" }}>·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}

      {/* Daily practice */}
      {report.daily_practice?.length > 0 && (
        <>
          <SectionHeader title="Daily Practice" subtitle="Habits to build" className="mt-10" />
          <Card testId="daily-practice" className="mt-4">
            <ul className="space-y-2">
              {report.daily_practice.map((p, i) => (
                <li
                  key={i}
                  className="text-[13.5px] text-ink/80 leading-relaxed flex gap-2"
                  data-testid={`daily-practice-${i}`}
                >
                  <span style={{ color: "#5C7A5A" }}>·</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {/* Avoid */}
      {report.avoid?.length > 0 && (
        <>
          <SectionHeader title="Avoid" subtitle="For your constitution" className="mt-10" />
          <div className="mt-4 flex flex-wrap gap-2">
            {report.avoid.map((a, i) => (
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
      {report.herbs?.length > 0 && (
        <>
          <SectionHeader title="Ayurvedic Herbs" subtitle="How to bring them in" className="mt-10" />
          <div className="mt-4 space-y-3">
            {report.herbs.map((h, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white p-5 border border-[#5C7A5A]/10 shadow-soft"
                data-testid={`herb-${i}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-display text-[17px] text-ink">{h.name}</span>
                  <span className="text-[10px] tracking-widest uppercase gold-underline" style={{ color: "#B8632F" }}>
                    Herb
                  </span>
                </div>
                <p className="text-[13px] text-ink/70 mt-2 leading-relaxed">{h.usage}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* When to see doctor */}
      {report.when_to_see_doctor?.length > 0 && (
        <div
          className="mt-10 rounded-2xl bg-white p-5 border border-[#B8632F]/25 shadow-soft"
          data-testid="see-doctor"
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "rgba(184,99,47,0.15)", color: "#B8632F" }}
            >
              <AlertTriangle size={12} />
            </div>
            <span className="font-display text-[16px] text-ink">When to see a doctor</span>
          </div>
          <ul className="space-y-1.5">
            {report.when_to_see_doctor.map((w, i) => (
              <li
                key={i}
                className="text-[13.5px] text-ink/80 leading-relaxed flex gap-2"
                data-testid={`see-doctor-${i}`}
              >
                <span style={{ color: "#B8632F" }}>·</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Combo cross-sell / cross-nav */}
      <div className="mt-12">
        <div className="gold-divider mb-6" />
        {otherUnlocked ? (
          <button
            onClick={() => onSwitchCategory(otherCat)}
            className="btn-primary justify-center w-full"
            data-testid="switch-to-other-report"
          >
            <Sparkles size={16} />
            View your {otherCat} report
            <ArrowRight size={16} />
          </button>
        ) : (
          <div
            className="rounded-2xl bg-white p-5 border border-[#5C7A5A]/12 shadow-soft"
            data-testid="cross-sell"
          >
            <div className="font-display text-[17px] text-ink leading-snug">
              Also curious about your {otherCat} constitution?
            </div>
            <p className="text-[13px] text-ink/60 mt-1.5 leading-relaxed">
              Switch tabs at the top to complete your {otherCat} intake. Combo customers already have it unlocked.
            </p>
            <button
              onClick={() => onSwitchCategory(otherCat)}
              className="btn-ghost mt-4"
              data-testid="switch-cat-btn"
            >
              Go to {otherCat}
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        <button
          onClick={onRestart}
          className="btn-ghost justify-center w-full mt-3"
          data-testid="report-restart-btn"
        >
          <RotateCcw size={13} />
          Redo my {category} intake
        </button>

        <p className="mt-8 text-[11px] text-ink/45 text-center leading-relaxed">
          Guidance is educational and not a substitute for medical advice.
          Patch-test new ingredients.
        </p>
      </div>
    </div>
  );
}

function Card({ children, testId, className = "" }) {
  return (
    <div
      className={`rounded-2xl bg-white p-6 border border-[#5C7A5A]/10 shadow-soft ${className}`}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }) {
  return <span className="eyebrow">{children}</span>;
}

function SectionHeader({ title, subtitle, className = "" }) {
  return (
    <div className={className}>
      <Eyebrow>{title}</Eyebrow>
      <div className="font-display text-[22px] text-ink leading-tight mt-1">
        {subtitle}
      </div>
    </div>
  );
}
