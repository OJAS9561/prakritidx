import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Check, Sparkles, ShieldCheck } from "lucide-react";
import { createPaymentLink, verifyPayment } from "../lib/api";

/**
 * PayGate — pick plan, create Razorpay Payment Link, open in new tab, poll for status.
 */
export default function PayGate({ category, sessionId, hook, onPaid, onBack }) {
  const [plan, setPlan] = useState("single");
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState(null); // { short_url, reference_id, amount_rupees }
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPayment = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await createPaymentLink({
        session_id: sessionId,
        plan,
        category,
      });
      setLink(res);
      // Open Razorpay hosted link in new tab
      window.open(res.short_url, "_blank", "noopener");
      // Start polling
      setPolling(true);
      pollRef.current = setInterval(() => pollStatus(res.reference_id), 3000);
    } catch (e) {
      setError(
        e?.response?.data?.detail ||
          "Could not start payment. Please ensure Razorpay test keys are set in the backend .env."
      );
    } finally {
      setCreating(false);
    }
  };

  const pollStatus = async (refId) => {
    try {
      const res = await verifyPayment(sessionId, refId);
      if (res.status === "paid") {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(false);
        onPaid?.();
      }
    } catch {
      // ignore transient poll errors
    }
  };

  const manualCheck = async () => {
    if (!link) return;
    setPolling(true);
    await pollStatus(link.reference_id);
    setPolling(false);
  };

  return (
    <div className="pb-10" data-testid={`pay-${category}`}>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#5C7A5A]/15 text-ink/70 hover:bg-white transition-colors"
          data-testid="pay-back-btn"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="eyebrow">Unlock your report</span>
        <div className="w-9" />
      </div>

      <h1 className="font-display text-[30px] leading-tight tracking-tight text-ink">
        One-time unlock. No subscription.
      </h1>
      {hook?.dosha_label && (
        <p className="text-[14px] text-ink/60 mt-2">
          For your <span className="text-ink font-medium">{hook.dosha_label}-leaning</span> {category} constitution.
        </p>
      )}

      <div className="gold-divider my-6" />

      <div className="space-y-3">
        <PlanCard
          testId="plan-single"
          active={plan === "single"}
          onClick={() => setPlan("single")}
          title={`Full ${category} report`}
          price={99}
          features={[
            "Complete Ayurvedic routine",
            "Ingredients + diet plan",
            "Daily practice",
            "Herbs & how to use them",
          ]}
        />
        <PlanCard
          testId="plan-combo"
          active={plan === "combo"}
          onClick={() => setPlan("combo")}
          title="Skin + Hair combo"
          price={149}
          features={[
            "Unlocks BOTH sections",
            "Save ₹49 vs. buying separately",
            "Same one-time payment",
          ]}
          highlight
        />
      </div>

      <div className="mt-8">
        {!link ? (
          <button
            onClick={startPayment}
            disabled={creating}
            className="btn-primary justify-center w-full"
            data-testid="start-payment-btn"
          >
            {creating ? "Creating payment link…" : (
              <>
                <Sparkles size={16} />
                Pay ₹{plan === "single" ? 99 : 149} securely
                <ExternalLink size={16} />
              </>
            )}
          </button>
        ) : (
          <div className="rounded-2xl bg-white p-5 border border-[#5C7A5A]/15 shadow-soft" data-testid="pay-waiting">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(217,164,65,0.15)", color: "#B8632F" }}
              >
                <ShieldCheck size={18} />
              </div>
              <div className="flex-1">
                <div className="font-display text-[17px] text-ink leading-tight">
                  Waiting for payment
                </div>
                <p className="text-[13px] text-ink/65 mt-1 leading-relaxed">
                  Complete your ₹{link.amount_rupees} payment in the Razorpay tab. We'll unlock your report automatically.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={link.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary justify-center w-full"
                data-testid="reopen-payment-link"
              >
                Reopen payment tab
                <ExternalLink size={15} />
              </a>
              <button
                onClick={manualCheck}
                className="btn-ghost justify-center w-full"
                data-testid="pay-check-btn"
              >
                {polling ? "Checking…" : "I've paid — check status"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 text-sm text-copper text-center" data-testid="pay-error">
          {error}
        </div>
      )}

      <div className="mt-10 text-[11px] text-ink/45 text-center leading-relaxed">
        Powered by Razorpay · Test mode · UPI · Cards · Netbanking
      </div>
    </div>
  );
}

function PlanCard({ testId, active, onClick, title, price, features, highlight }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="w-full text-left rounded-2xl bg-white p-5 border transition-colors relative"
      style={{
        borderColor: active ? "#5C7A5A" : "rgba(58,79,58,0.15)",
        boxShadow: active
          ? "0 0 0 2px #5C7A5A, 0 12px 30px rgba(43,43,38,0.08)"
          : "0 8px 30px rgba(43,43,38,0.05)",
      }}
    >
      {highlight && (
        <span
          className="absolute -top-2 right-4 px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-widest uppercase"
          style={{ background: "#D9A441", color: "#2B2B26" }}
          data-testid={`${testId}-badge`}
        >
          Best value
        </span>
      )}
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-[19px] text-ink leading-tight">
            {title}
          </div>
          <div className="text-[12px] text-ink/55 mt-0.5 tracking-wide">
            One-time · No subscription
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[26px] text-ink leading-none gold-underline">
            ₹{price}
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {features.map((f, i) => (
          <li key={i} className="text-[13px] text-ink/75 flex gap-2 items-start">
            <Check size={13} className="mt-1 flex-shrink-0" style={{ color: "#5C7A5A" }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
