import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Leaf, Lock, Unlock } from "lucide-react";

const HERO_IMAGES = {
  skin: "https://images.pexels.com/photos/7019484/pexels-photo-7019484.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  hair: "https://images.unsplash.com/photo-1632765854612-9b02b6ec2b15?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwzfHx3b21hbiUyMGhlYWx0aHklMjBoYWlyJTIwbmF0dXJhbHxlbnwwfHx8fDE3ODQzNjcyMzB8MA&ixlib=rb-4.1.0&q=85",
};

const COPY = {
  skin: {
    eyebrow: "Skin · Prakriti",
    title: "Skin that reads your constitution.",
    sub: "Share what you're seeing — in words, a selfie, or a lab report. We map it to your dosha, then unlock a routine, ingredients, and diet built precisely for you.",
    cta: "Begin your Skin intake",
    stats: [
      { k: "Chat", v: "in your words" },
      { k: "Selfie", v: "AI vision" },
      { k: "Report", v: "personalized" },
    ],
  },
  hair: {
    eyebrow: "Hair · Prakriti",
    title: "Hair care, precisely mapped to you.",
    sub: "Tell us what's happening with your scalp and strands. Add a selfie or a lab report. Unlock a routine, ingredients, and diet crafted for your dosha and your presentation.",
    cta: "Begin your Hair intake",
    stats: [
      { k: "Chat", v: "in your words" },
      { k: "Selfie", v: "AI vision" },
      { k: "Report", v: "personalized" },
    ],
  },
};

export default function Landing({ category, onStart, onViewLast, unlocked, onViewReport }) {
  const c = COPY[category];

  return (
    <div className="pb-8" data-testid={`landing-${category}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative rounded-3xl overflow-hidden shadow-soft mb-6"
        style={{ aspectRatio: "4 / 5", background: "#EDE8DC" }}
      >
        <img
          src={HERO_IMAGES[category]}
          alt=""
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(43,43,38,0) 40%, rgba(43,43,38,0.55) 100%)",
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <span className="eyebrow" style={{ color: "#FAF7F0", opacity: 0.9 }}>
            {c.eyebrow}
          </span>
          <div className="mt-2 flex items-center gap-2">
            <Leaf size={14} style={{ color: "#D9A441" }} />
            <span className="text-[11px] tracking-widest uppercase text-white/85 font-medium">
              Ayurveda × Modern Science
            </span>
          </div>
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="font-display text-[34px] leading-[1.05] tracking-tight text-ink"
        data-testid="landing-title"
      >
        {c.title}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5 }}
        className="mt-4 text-[15px] leading-relaxed text-ink/70"
      >
        {c.sub}
      </motion.p>

      <div className="gold-divider my-7" />

      <div className="grid grid-cols-3 gap-3 mb-8">
        {c.stats.map((s, i) => (
          <motion.div
            key={s.v}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 + i * 0.06, duration: 0.4 }}
            className="rounded-2xl bg-white p-4 border border-[#5C7A5A]/10 shadow-soft"
            data-testid={`stat-${i}`}
          >
            <div className="font-display text-xl text-ink leading-none">{s.k}</div>
            <div className="text-[10px] tracking-widest uppercase text-ink/50 mt-2">
              {s.v}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onStart}
          className="btn-primary justify-center"
          data-testid="start-intake-btn"
        >
          <Sparkles size={16} />
          {c.cta}
          <ArrowRight size={16} />
        </button>

        {unlocked && onViewReport && (
          <button
            onClick={onViewReport}
            className="btn-ghost justify-center"
            data-testid="view-report-btn"
            style={{ borderColor: "rgba(217,164,65,0.5)" }}
          >
            <Unlock size={14} style={{ color: "#B8632F" }} />
            View my unlocked {category} report
          </button>
        )}

        {!unlocked && onViewLast && (
          <button
            onClick={onViewLast}
            className="btn-ghost justify-center"
            data-testid="view-last-hook-btn"
          >
            <Lock size={13} />
            Continue your last {category} read
          </button>
        )}
      </div>

      <div className="mt-10 rounded-2xl bg-white p-5 border border-[#5C7A5A]/10 shadow-soft">
        <span className="eyebrow">How it works</span>
        <ol className="mt-3 space-y-2.5 text-[13.5px] text-ink/75 leading-relaxed">
          {[
            "Share your concern in your own words + selfie or lab report (optional).",
            "Answer 6 quick multi-select questions.",
            "Get a free glimpse of your dosha read.",
            "Unlock the full routine, ingredients & diet for ₹99 (or ₹149 for Skin + Hair).",
          ].map((s, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0"
                style={{ background: "rgba(217,164,65,0.18)", color: "#B8632F" }}
              >
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
