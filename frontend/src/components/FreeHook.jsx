import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { getFreeHook } from "../lib/api";
import DoshaDial, { getDoshaInsight } from "./DoshaDial";

/**
 * FreeHook — deliberately partial. Static frame + AI-generated 1-liner.
 * Locked content teased in a blurred preview card. CTA drives to payment.
 */
export default function FreeHook({
  category,
  sessionId,
  onHookLoaded,
  onBlocked,
  onUnlock,
  onRestart,
  existingHook,
}) {
  const [hook, setHook] = useState(existingHook || null);
  const [loading, setLoading] = useState(!existingHook);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (existingHook) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getFreeHook({ session_id: sessionId, category })
      .then((res) => {
        if (cancelled) return;
        if (res.blocked) {
          onBlocked?.(res);
          return;
        }
        setHook(res);
        onHookLoaded?.(res);
      })
      .catch(() => !cancelled && setError("Could not load your free read."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, category]);

  if (loading) {
    return (
      <div className="py-24 text-center" data-testid="hook-loading">
        <div className="inline-block w-8 h-8 rounded-full border-2 border-[#5C7A5A] border-t-transparent animate-spin" />
        <div className="mt-4 text-sm text-ink/60">Reading your inputs…</div>
      </div>
    );
  }

  if (error || !hook) {
    return (
      <div className="py-24 text-center" data-testid="hook-error">
        <div className="text-ink/80 mb-4">{error || "Unable to load your read."}</div>
        <button className="btn-ghost" onClick={onRestart}>Restart</button>
      </div>
    );
  }

  return (
    <div className="pb-8" data-testid={`free-hook-${category}`}>
      <div className="text-center pt-2">
        <span className="eyebrow" data-testid="hook-eyebrow">
          Free glimpse · Your {category} read
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-6 mx-auto flex flex-col items-center"
      >
        <DoshaDial
          breakdown={hook.dosha_breakdown}
          dominant={hook.dosha}
          dominantLabel={hook.dosha_label}
        />
        <h1
          className="font-display text-[36px] leading-tight tracking-tight text-ink mt-6"
          data-testid="hook-dosha-label"
        >
          {hook.dosha_label}-leaning
        </h1>
        <p
          className="mt-4 text-[13.5px] leading-relaxed text-ink/70 text-center px-2"
          data-testid="hook-dosha-insight"
        >
          {getDoshaInsight(category, hook.dosha_breakdown, hook.dosha)}
        </p>
      </motion.div>

      <div className="gold-divider my-7" />

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="text-[16px] leading-[1.6] text-ink/85"
        data-testid="hook-text"
      >
        {hook.hook}
      </motion.p>

      {/* Locked preview card — blurred/darkened stack that teases what's inside */}
      <div className="mt-9">
        <span className="eyebrow">Locked in your full report</span>
        <div className="relative mt-4">
          <div className="space-y-3 pointer-events-none select-none" aria-hidden="true">
            {[
              "Morning routine — 5 steps precisely tuned for you",
              "Ayurvedic + modern key ingredients",
              "Foods to favour and reduce",
              "Daily practice for your constitution",
              "Herbs, dosage, and how to use them",
            ].map((label, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white p-4 border border-[#5C7A5A]/10 shadow-soft flex items-center gap-3"
                style={{ filter: "blur(2.6px)", opacity: 0.7 }}
              >
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0"
                  style={{ background: "rgba(217,164,65,0.25)" }}
                />
                <div className="flex-1">
                  <div
                    className="h-3 rounded-full"
                    style={{ background: "rgba(43,43,38,0.14)", width: `${70 - i * 6}%` }}
                  />
                  <div
                    className="h-2 rounded-full mt-2"
                    style={{ background: "rgba(43,43,38,0.08)", width: `${52 - i * 4}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Fade overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(250,247,240,0) 0%, rgba(250,247,240,0.4) 60%, rgba(250,247,240,0.92) 100%)",
            }}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
            <div
              className="rounded-full flex items-center justify-center gap-2 px-4 py-2 shadow-soft"
              style={{ background: "#FAF7F0", border: "1px solid rgba(217,164,65,0.4)" }}
            >
              <Lock size={13} style={{ color: "#B8632F" }} />
              <span
                className="text-[11px] tracking-widest uppercase"
                style={{ color: "#3A4F3A", fontWeight: 600 }}
              >
                Unlock the full report
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <button
          onClick={onUnlock}
          className="btn-primary justify-center"
          data-testid="unlock-btn"
        >
          <Sparkles size={16} />
          Unlock my full report
          <ArrowRight size={16} />
        </button>
        <button
          onClick={onRestart}
          className="btn-ghost justify-center"
          data-testid="hook-restart-btn"
        >
          <RotateCcw size={14} />
          Redo my intake
        </button>
      </div>

      <p className="mt-8 text-[11px] text-ink/45 text-center leading-relaxed">
        Guidance is educational. Not a substitute for medical advice.
      </p>
    </div>
  );
}
