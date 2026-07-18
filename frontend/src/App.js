import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "./components/AppShell";
import Landing from "./components/Landing";
import DoshaFlow from "./components/DoshaFlow";
import ResultsScreen from "./components/ResultsScreen";
import Recommendations from "./components/Recommendations";
import { getOrCreateSessionId } from "./lib/session";
import "./App.css";

/**
 * PrakritiDx — mobile-first Ayurvedic skin & hair guidance.
 * The app is fully parameterized by `category` (skin | hair). Same components render both.
 * Stages: landing → quiz → result → recommendations
 */
export default function App() {
  const [category, setCategory] = useState("skin");
  const [stage, setStage] = useState("landing"); // landing | quiz | result | recommendations
  const [result, setResult] = useState(null); // quiz result for the CURRENT session+category
  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  // Persist per-category stage & result in localStorage so switching Skin<>Hair keeps context
  const stateKey = `prakritidx:state:${category}`;

  useEffect(() => {
    // hydrate stage/result for the newly-selected category
    try {
      const saved = JSON.parse(localStorage.getItem(stateKey) || "null");
      if (saved && saved.stage) {
        setStage(saved.stage);
        setResult(saved.result || null);
      } else {
        setStage("landing");
        setResult(null);
      }
    } catch {
      setStage("landing");
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    try {
      localStorage.setItem(stateKey, JSON.stringify({ stage, result }));
    } catch {
      /* ignore */
    }
  }, [stage, result, stateKey]);

  const restart = () => {
    setResult(null);
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full"
        >
          {stage === "landing" && (
            <Landing
              category={category}
              onStart={() => setStage("quiz")}
              onViewResult={result ? () => setStage("result") : null}
            />
          )}
          {stage === "quiz" && (
            <DoshaFlow
              category={category}
              sessionId={sessionId}
              onComplete={(r) => {
                setResult(r);
                setStage("result");
              }}
              onExit={() => setStage("landing")}
            />
          )}
          {stage === "result" && result && (
            <ResultsScreen
              category={category}
              result={result}
              onSeeRoutine={() => setStage("recommendations")}
              onRetake={restart}
            />
          )}
          {stage === "recommendations" && result && (
            <Recommendations
              category={category}
              sessionId={sessionId}
              result={result}
              onBack={() => setStage("result")}
              onRestart={restart}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
