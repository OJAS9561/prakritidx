import React from "react";
import { motion } from "framer-motion";
import { AlertOctagon, PhoneCall } from "lucide-react";

/**
 * Hard-block screen. No bypass. No acknowledge-and-continue. This is intentional.
 */
export default function SafetyBlock({ message }) {
  return (
    <div className="pb-10 pt-6" data-testid="safety-block">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="mx-auto flex flex-col items-center text-center"
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(184,99,47,0.18), rgba(184,99,47,0.06))",
            color: "#B8632F",
          }}
        >
          <AlertOctagon size={36} strokeWidth={1.5} />
        </div>
      </motion.div>

      <div className="text-center mt-6">
        <span className="eyebrow" style={{ color: "#B8632F" }} data-testid="safety-eyebrow">
          Please see a doctor
        </span>
      </div>

      <h1
        className="font-display text-[26px] leading-tight tracking-tight text-ink text-center mt-3"
        data-testid="safety-title"
      >
        This needs medical care, not a routine.
      </h1>

      <div className="gold-divider my-6" />

      <p
        className="text-[15px] text-ink/80 leading-relaxed text-center px-2"
        data-testid="safety-message"
      >
        {message ||
          "This sounds like something that needs a doctor's attention rather than a lifestyle routine. Please consult a physician or visit a clinic — PrakritiDx isn't able to safely guide you on this. If it's urgent, please seek immediate medical care."}
      </p>

      <div className="mt-8 rounded-2xl bg-white p-5 border border-[#B8632F]/20 shadow-soft">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(184,99,47,0.12)", color: "#B8632F" }}
          >
            <PhoneCall size={16} />
          </div>
          <div>
            <div className="font-display text-[16px] text-ink leading-tight">
              If this feels urgent
            </div>
            <p className="text-[13px] text-ink/65 mt-1 leading-relaxed">
              Please contact your local emergency service or the nearest clinic
              immediately. Do not delay medical attention for a wellness routine.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-10 text-[11px] text-ink/45 text-center leading-relaxed">
        PrakritiDx is a lifestyle guidance app. It is not a diagnostic tool and
        does not replace professional medical care.
      </p>
    </div>
  );
}
