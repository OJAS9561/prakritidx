import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Lock, Unlock, MessageCircle, Camera, FileText } from "lucide-react";
import Logo from "./Logo";

const COPY = {
  skin: {
    eyebrow: "Skin · PrakritiDx",
    title: "Know your skin's constitution.",
    sub: "Share what you're seeing — in words, a selfie, or a lab report. We map it to your dosha, then unlock a routine, ingredients, and diet built precisely for you.",
    cta: "Begin your Skin intake",
  },
  hair: {
    eyebrow: "Hair · PrakritiDx",
    title: "Know your hair's constitution.",
    sub: "Tell us what's happening with your scalp and strands. Add a selfie or a lab report. Unlock a routine, ingredients, and diet crafted for your dosha and your presentation.",
    cta: "Begin your Hair intake",
  },
};

const FEATURES = [
  { icon: MessageCircle, title: "Chat", desc: "Understands your problem easily" },
  { icon: Camera, title: "Selfie", desc: "Perfect analysis of selfie and previous report" },
  { icon: FileText, title: "Report", desc: "Personalized report for in depth solution" },
  { icon: Sparkles, title: "Free Preview", desc: "Try your dosha read for free" },
];

export default function Landing({ category, onStart, onViewLast, unlocked, onViewReport }) {
  const c = COPY[category];

  return (
    <div className="pb-8" data-testid={`landing-${category}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative flex flex-col items-center text-center pt-2 pb-2"
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 260,
            height: 260,
            background:
              "radial-gradient(circle, rgba(217,164,65,0.30) 0%, rgba(217,164,65,0.08) 45%, transparent 72%)",
            filter: "blur(2px)",
          }}
        />
        <Logo size={148} className="relative" />
        <div className="mt-4 flex items-center gap-2">
          <span className="eyebrow opacity-75">{c.eyebrow}</span>
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="font-display text-[32px] leading-[1.08] tracking-tight text-ink text-center mt-3"
        data-testid="landing-title"
      >
        {c.title}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5 }}
        className="mt-3.5 text-[14.5px] leading-relaxed text-ink/70 text-center px-1"
      >
        {c.sub}
      </motion.p>

      <div className="flex flex-col gap-3.5 mt-6 mb-2">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 + i * 0.06, duration: 0.4 }}
            className="rounded-2xl bg-white/55 backdrop-blur-sm p-3.5 border border-[#5C7A5A]/10 flex items-start gap-3"
            data-testid={`feature-${i}`}
          >
            <div
              className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #547152 0%, #1A251A 100%)",
                boxShadow: "0 0 0 1px rgba(217,164,65,0.35), 0 4px 10px rgba(58,79,58,0.30)",
              }}
            >
              <f.icon size={15} style={{ color: "#F3D385" }} />
            </div>
            <div>
              <div className="font-display text-sm text-ink">{f.title}</div>
              <div className="text-[12.5px] text-ink/60 mt-0.5 leading-snug">{f.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-3 mt-3">
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
