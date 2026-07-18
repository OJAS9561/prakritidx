import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, X, Check } from "lucide-react";
import { getQuiz, submitQuiz } from "../lib/api";

/**
 * DoshaFlow — the reusable multi-step quiz used by BOTH Skin and Hair sections.
 * Parameterized by `category`. Renders question-by-question with progress + fade animation.
 */
export default function DoshaFlow({ category, sessionId, onComplete, onExit }) {
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { q1: 'vata' }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIdx(0);
    setAnswers({});
    getQuiz(category)
      .then((data) => {
        if (cancelled) return;
        setQuestions(data.questions || []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load quiz. Please try again.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category]);

  const total = questions.length;
  const current = questions[idx];
  const progress = total > 0 ? ((idx + 1) / total) * 100 : 0;
  const selectedValue = current ? answers[current.id] : null;

  const goNext = () => {
    if (idx < total - 1) setIdx(idx + 1);
    else finish();
  };
  const goPrev = () => idx > 0 && setIdx(idx - 1);

  const choose = (value) => {
    if (!current) return;
    setAnswers({ ...answers, [current.id]: value });
    // Slight delay for the selection animation before advancing
    setTimeout(() => {
      if (idx < total - 1) setIdx(idx + 1);
    }, 220);
  };

  const finish = async () => {
    if (Object.keys(answers).length < 6) {
      setError("Please answer at least 6 questions.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        session_id: sessionId,
        category,
        answers: Object.entries(answers).map(([question_id, value]) => ({
          question_id,
          value,
        })),
      };
      const result = await submitQuiz(payload);
      onComplete(result);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center" data-testid="quiz-loading">
        <div className="inline-block w-8 h-8 rounded-full border-2 border-[#5C7A5A] border-t-transparent animate-spin" />
        <div className="mt-4 text-sm text-ink/60">Loading quiz…</div>
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="py-24 text-center" data-testid="quiz-error">
        <div className="text-ink/80 mb-4">{error}</div>
        <button className="btn-ghost" onClick={onExit}>Back</button>
      </div>
    );
  }

  return (
    <div className="pb-8" data-testid={`quiz-${category}`}>
      {/* Top bar: back + progress + exit */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goPrev}
          disabled={idx === 0}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#5C7A5A]/15 text-ink/70 disabled:opacity-30 hover:bg-white transition-colors"
          data-testid="quiz-back-btn"
          aria-label="Previous question"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between text-[10px] tracking-widest uppercase text-ink/50 mb-1.5">
            <span>Question {idx + 1} of {total}</span>
            <span style={{ color: "#B8632F" }}>{category}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button
          onClick={onExit}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#5C7A5A]/15 text-ink/60 hover:bg-white transition-colors"
          data-testid="quiz-exit-btn"
          aria-label="Exit quiz"
        >
          <X size={16} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current?.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {current && (
            <>
              <h2
                className="font-display text-[26px] leading-[1.15] tracking-tight text-ink mb-6"
                data-testid="quiz-question"
              >
                {current.prompt}
              </h2>

              <div className="space-y-3">
                {current.options.map((opt) => {
                  const isSelected = selectedValue === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => choose(opt.value)}
                      className={`w-full text-left rounded-2xl bg-white p-5 border transition-colors ${
                        isSelected
                          ? "border-transparent"
                          : "border-[#5C7A5A]/12 hover:border-[#5C7A5A]/30"
                      }`}
                      style={isSelected ? {} : { boxShadow: "0 8px 30px rgba(43,43,38,0.05)" }}
                      data-testid={`choice-${current.id}-${opt.value}`}
                    >
                      <div
                        className={isSelected ? "choice-ring-selected rounded-xl p-3 -m-3" : ""}
                        style={{ transition: "box-shadow 0.25s ease" }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-5 h-5 rounded-full mt-0.5 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? "" : "border border-[#5C7A5A]/40"
                            }`}
                            style={
                              isSelected
                                ? { background: "#5C7A5A", color: "#FAF7F0" }
                                : {}
                            }
                          >
                            {isSelected && <Check size={12} />}
                          </div>
                          <span className="text-[15px] text-ink leading-relaxed flex-1">
                            {opt.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <div
          className="mt-6 text-sm text-copper text-center"
          data-testid="quiz-error-msg"
        >
          {error}
        </div>
      )}

      {/* Bottom action: only shown on last question when answered, OR to skip forward */}
      <div className="mt-8 flex items-center justify-between">
        <span className="text-xs text-ink/50">
          {Object.keys(answers).length} answered
        </span>
        <button
          onClick={idx === total - 1 ? finish : goNext}
          disabled={!selectedValue || submitting}
          className="btn-primary"
          data-testid={idx === total - 1 ? "quiz-submit-btn" : "quiz-next-btn"}
        >
          {submitting
            ? "Reading your prakriti…"
            : idx === total - 1
            ? "Reveal my Prakriti"
            : "Next"}
          {!submitting && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  );
}
