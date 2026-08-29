import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "./components/AppShell";
import Landing from "./components/Landing";
import IntakeFlow from "./components/IntakeFlow";
import SafetyBlock from "./components/SafetyBlock";
import FreeHook from "./components/FreeHook";
import PayGate from "./components/PayGate";
import FullReport from "./components/FullReport";
import InstallPrompt from "./components/InstallPrompt";
import { getOrCreateSessionId } from "./lib/session";
import { getPaymentStatus } from "./lib/api";
import "./App.css";

/**
 * PrakritiDx v2 — chat + selfie + lab + fixed MCQ intake → safety check →
 * free hook → payment gate → full AI report. Fully parameterized by `category`.
 *
 * Stage machine (per category, persisted in localStorage):
 *   landing → intake → safety_blocked (terminal) | free_hook → pay → report
 */
export default function App() {
  // A restore link (see session.js) may also carry `cat=skin|hair` so the
  // person lands directly on the category their email was about, and
  // `restoredFromLink` lets us auto-jump straight to their report below
  // instead of making them tap "View my unlocked report" themselves.
  const [restoredFromLink] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("restore") ? true : false;
    } catch {
      return false;
    }
  });
  const [category, setCategory] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get("cat");
      return cat === "hair" ? "hair" : "skin";
    } catch {
      return "skin";
    }
  });
  const [stage, setStage] = useState("landing");
  const [intakeAck, setIntakeAck] = useState(null); // { blocked, message?, reason? }
  const [hook, setHook] = useState(null); // { hook, dosha, dosha_label }
  const [paymentInfo, setPaymentInfo] = useState(null); // { plan, unlocked }
  const [unlockedMap, setUnlockedMap] = useState({ skin: false, hair: false });

  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const stateKey = `prakritidx:v2:${category}`;

  // hydrate per-category state on category change
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(stateKey) || "null");
      if (saved) {
        setStage(saved.stage || "landing");
        setIntakeAck(saved.intakeAck || null);
        setHook(saved.hook || null);
        setPaymentInfo(saved.paymentInfo || null);
      } else {
        setStage("landing");
        setIntakeAck(null);
        setHook(null);
        setPaymentInfo(null);
      }
    } catch {
      setStage("landing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // persist per-category state
  useEffect(() => {
    try {
      localStorage.setItem(
        stateKey,
        JSON.stringify({ stage, intakeAck, hook, paymentInfo })
      );
    } catch {
      /* ignore */
    }
  }, [stage, intakeAck, hook, paymentInfo, stateKey]);

  // Poll unlock status on load and after payments
  const refreshUnlockStatus = useCallback(async () => {
    try {
      const data = await getPaymentStatus(sessionId);
      setUnlockedMap(data.unlocked || { skin: false, hair: false });
      return data;
    } catch {
      return null;
    }
  }, [sessionId]);

  useEffect(() => {
    refreshUnlockStatus();
    // If URL has ?paid_ref, trigger a status check
    const url = new URL(window.location.href);
    if (url.searchParams.get("paid_ref")) {
      // Give the webhook a moment then poll
      setTimeout(refreshUnlockStatus, 800);
    }
  }, [refreshUnlockStatus]);

  // If the current category becomes unlocked (via combo, or from previous session), auto-progress
  useEffect(() => {
    if (unlockedMap[category] && stage === "pay") {
      setStage("report");
    }
  }, [unlockedMap, category, stage]);

  // Coming from a restore link (see session.js / EmailReportCard) and this
  // category is confirmed unlocked — skip straight to the report instead of
  // making them tap through Landing themselves.
  useEffect(() => {
    if (restoredFromLink && unlockedMap[category] && stage === "landing") {
      setStage("report");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredFromLink, unlockedMap, category]);

  const restart = () => {
    setIntakeAck(null);
    setHook(null);
    setPaymentInfo(null);
    setStage("landing");
    try {
      localStorage.removeItem(stateKey);
    } catch {
      /* ignore */
    }
  };

  return (
    <AppShell category={category} onCategoryChange={setCategory}>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${category}-${stage}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full"
        >
          {stage === "landing" && (
            <Landing
              category={category}
              onStart={() => setStage("intake")}
              onViewLast={hook ? () => setStage("free_hook") : null}
              unlocked={unlockedMap[category]}
              onViewReport={
                unlockedMap[category] ? () => setStage("report") : null
              }
            />
          )}

          {stage === "intake" && (
            <IntakeFlow
              category={category}
              sessionId={sessionId}
              onExit={() => setStage("landing")}
              onSubmitted={(ack) => {
                setIntakeAck(ack);
                if (ack.blocked) setStage("safety_blocked");
                else setStage("free_hook");
              }}
            />
          )}

          {stage === "safety_blocked" && (
            <SafetyBlock message={intakeAck?.message} />
          )}

          {stage === "free_hook" && (
            <FreeHook
              category={category}
              sessionId={sessionId}
              onHookLoaded={setHook}
              onBlocked={(ack) => {
                setIntakeAck(ack);
                setStage("safety_blocked");
              }}
              onUnlock={() => setStage("pay")}
              onRestart={restart}
              existingHook={hook}
            />
          )}

          {stage === "pay" && (
            <PayGate
              category={category}
              sessionId={sessionId}
              hook={hook}
              onPaid={async () => {
                await refreshUnlockStatus();
                setStage("report");
              }}
              onBack={() => setStage("free_hook")}
            />
          )}

          {stage === "report" && (
            <FullReport
              category={category}
              sessionId={sessionId}
              onRestart={restart}
              onSwitchCategory={(next) => setCategory(next)}
              unlockedMap={unlockedMap}
            />
          )}
        </motion.div>
      </AnimatePresence>
      <InstallPrompt />
    </AppShell>
  );
}
