import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Leaf, Sparkles, RotateCcw } from "lucide-react";

const HERO_IMAGES = {
  skin: "https://images.pexels.com/photos/7019484/pexels-photo-7019484.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  hair: "https://images.unsplash.com/photo-1632765854612-9b02b6ec2b15?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwzfHx3b21hbiUyMGhlYWx0aHklMjBoYWlyJTIwbmF0dXJhbHxlbnwwfHx8fDE3ODQzNjcyMzB8MA&ixlib=rb-4.1.0&q=85",
};

const COPY = {
  skin: {
    eyebrow: "Skin · Prakriti",
    title: "Skin that reads your constitution.",
    sub: "A 2-minute Ayurvedic assessment reveals your dominant dosha and a science-backed skincare rhythm tuned to how your skin actually behaves.",
    cta: "Take the Skin Prakriti Quiz",
    stats: [
      { k: "12", v: "Questions" },
      { k: "3", v: "Doshas mapped" },
      { k: "AI", v: "Personalized" },
    ],
  },
  hair: {
    eyebrow: "Hair · Prakriti",
    title: "Hair care rewritten by your dosha.",
    sub: "Discover the Ayurvedic constitution behind your scalp and strands, then get a modern routine of oils, herbs, and habits tailored to you.",
    cta: "Take the Hair Prakriti Quiz",
    stats: [
      { k: "12", v: "Questions" },
      { k: "3", v: "Doshas mapped" },
      { k: "AI", v: "Personalized" },
    ],
  },
};

export default function Landing({ category, onStart, onViewResult }) {
  const c = COPY[category];

  return (
    <div className="pb-8" data-testid={`landing-${category}`}>
      {/* Hero image */}
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

      {/* Headline */}
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

      {/* Gold divider */}
      <div className="gold-divider my-7" />

      {/* Stats row */}
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
            <div className="font-display text-2xl text-ink leading-none">{s.k}</div>
            <div className="text-[10px] tracking-widest uppercase text-ink/50 mt-2">
              {s.v}
            </div>
          </motion.div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onStart}
          className="btn-primary justify-center"
          data-testid="start-quiz-btn"
        >
          <Sparkles size={16} />
          {c.cta}
          <ArrowRight size={16} />
        </button>

        {onViewResult && (
          <button
            onClick={onViewResult}
            className="btn-ghost justify-center"
            data-testid="view-result-btn"
          >
            <RotateCcw size={14} />
            View your last {category} result
          </button>
        )}
      </div>

      {/* Tri-dosha primer */}
      <div className="mt-10">
        <span className="eyebrow">The Three Doshas</span>
        <div className="mt-4 space-y-3">
          {[
            { name: "Vata", desc: "Air & Space · dry, light, mobile", color: "#8B7BAA" },
            { name: "Pitta", desc: "Fire & Water · hot, sharp, intense", color: "#B8632F" },
            { name: "Kapha", desc: "Earth & Water · heavy, cool, stable", color: "#5C7A5A" },
          ].map((d) => (
            <div
              key={d.name}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 border border-[#5C7A5A]/10 shadow-soft card-lift"
              data-testid={`dosha-primer-${d.name.toLowerCase()}`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-display text-lg text-white"
                style={{ background: d.color }}
              >
                {d.name[0]}
              </div>
              <div className="flex-1">
                <div className="font-display text-lg text-ink leading-tight">{d.name}</div>
                <div className="text-xs text-ink/60 mt-0.5">{d.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
