import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  X,
  Camera,
  FileText,
  Check,
  MessageCircle,
  Trash2,
  Upload,
} from "lucide-react";
import {
  getIntakeSchema,
  uploadSelfie,
  uploadLabReport,
  submitIntake,
} from "../lib/api";

/**
 * IntakeFlow — 3 steps:
 *   1. Describe (free-text chat + selfie + lab report — all optional)
 *   2. MCQ (6 multi-select questions on one scrollable screen)
 *   3. Medical history (optional free text)
 *
 * Reusable — parameterized by `category`. Backend applies the SAFETY CHECK on submit.
 */
export default function IntakeFlow({ category, sessionId, onExit, onSubmitted }) {
  const [step, setStep] = useState(1);
  const [schema, setSchema] = useState({ questions: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // step 1 state
  const [chatText, setChatText] = useState("");
  const [selfie, setSelfie] = useState(null); // { upload_id, previewUrl, fileName }
  const [lab, setLab] = useState(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [uploadingLab, setUploadingLab] = useState(false);

  // step 2 state — { q1: ['tzone','cheeks'], q2: [...] }
  const [answers, setAnswers] = useState({});

  // step 3 state
  const [medicalText, setMedicalText] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setStep(1);
    setChatText("");
    setSelfie(null);
    setLab(null);
    setAnswers({});
    setMedicalText("");

    getIntakeSchema(category)
      .then((data) => !cancelled && setSchema(data))
      .catch(() => !cancelled && setError("Could not load intake. Please retry."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [category]);

  const mcqQuestions = schema.questions?.filter((q) => q.type === "multi_select") || [];
  const q7 = schema.questions?.find((q) => q.id === "q7");

  const toggleAnswer = (qid, value) => {
    setAnswers((prev) => {
      const cur = new Set(prev[qid] || []);
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      return { ...prev, [qid]: Array.from(cur) };
    });
  };

  const handleSelfie = async (file) => {
    if (!file) return;
    setUploadingSelfie(true);
    setError(null);
    try {
      const previewUrl = URL.createObjectURL(file);
      const res = await uploadSelfie(sessionId, file);
      setSelfie({
        upload_id: res.upload_id,
        previewUrl,
        fileName: file.name,
      });
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not upload selfie.");
    } finally {
      setUploadingSelfie(false);
    }
  };

  const handleLab = async (file) => {
    if (!file) return;
    setUploadingLab(true);
    setError(null);
    try {
      const res = await uploadLabReport(sessionId, file);
      setLab({
        upload_id: res.upload_id,
        mime: res.mime,
        fileName: file.name,
      });
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not upload report.");
    } finally {
      setUploadingLab(false);
    }
  };

  const canProceedFromStep1 =
    chatText.trim().length > 0 || selfie || lab;

  const answeredMcqCount = mcqQuestions.filter(
    (q) => (answers[q.id]?.length || 0) > 0
  ).length;
  const canProceedFromStep2 = answeredMcqCount >= Math.min(4, mcqQuestions.length);

  const doSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const answerPayload = [];
      for (const q of mcqQuestions) {
        if (answers[q.id]?.length) {
          answerPayload.push({ question_id: q.id, values: answers[q.id] });
        }
      }
      if (medicalText.trim()) {
        answerPayload.push({ question_id: "q7", values: [], free_text: medicalText.trim() });
      }
      const payload = {
        session_id: sessionId,
        category,
        chat_text: chatText.trim() || null,
        answers: answerPayload,
        selfie_upload_id: selfie?.upload_id || null,
        lab_upload_id: lab?.upload_id || null,
      };
      const res = await submitIntake(payload);
      onSubmitted(res);
    } catch (e) {
      setError(e?.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center" data-testid="intake-loading">
        <div className="inline-block w-8 h-8 rounded-full border-2 border-[#5C7A5A] border-t-transparent animate-spin" />
        <div className="mt-4 text-sm text-ink/60">Loading intake…</div>
      </div>
    );
  }

  if (error && !schema.questions?.length) {
    return (
      <div className="py-24 text-center" data-testid="intake-error">
        <div className="text-ink/80 mb-4">{error}</div>
        <button className="btn-ghost" onClick={onExit}>Back</button>
      </div>
    );
  }

  const stepLabels = ["Describe", "Details", "Medical"];
  const progress = ((step - 1) / (stepLabels.length - 1)) * 100;

  return (
    <div className="pb-8" data-testid={`intake-${category}`}>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => (step === 1 ? onExit() : setStep(step - 1))}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#5C7A5A]/15 text-ink/70 hover:bg-white transition-colors"
          data-testid="intake-back-btn"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between text-[10px] tracking-widest uppercase text-ink/50 mb-1.5">
            <span>
              Step {step} of {stepLabels.length} · {stepLabels[step - 1]}
            </span>
            <span style={{ color: "#B8632F" }}>{category}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button
          onClick={onExit}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-[#5C7A5A]/15 text-ink/60 hover:bg-white transition-colors"
          data-testid="intake-exit-btn"
          aria-label="Exit intake"
        >
          <X size={16} />
        </button>
      </div>

      {step === 1 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h2 className="font-display text-[26px] leading-[1.15] tracking-tight text-ink">
            Tell us what's happening.
          </h2>
          <p className="text-[14px] text-ink/60 mt-2 leading-relaxed">
            Describe your concern in your own words. Adding a selfie or a lab report helps —
            but everything here is optional.
          </p>

          {/* Chat box */}
          <div className="mt-6">
            <label className="eyebrow" htmlFor="chat">Describe your concern</label>
            <div className="mt-2 rounded-2xl bg-white border border-[#5C7A5A]/12 shadow-soft focus-within:border-[#5C7A5A]/40 transition-colors">
              <div className="flex items-start gap-2 p-4">
                <MessageCircle size={18} className="mt-1 text-ink/40 flex-shrink-0" />
                <textarea
                  id="chat"
                  data-testid="intake-chat-input"
                  className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink/35 resize-none min-h-[92px] leading-relaxed"
                  placeholder={
                    category === "skin"
                      ? "e.g. My cheeks have been red and dry for 3 weeks, worse when I eat spicy food…"
                      : "e.g. My hair has been shedding heavily since last month, and my scalp is itchy…"
                  }
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  maxLength={2000}
                />
              </div>
            </div>
            <div className="text-right text-[10px] text-ink/40 mt-1">
              {chatText.length}/2000
            </div>
          </div>

          {/* Selfie upload */}
          <div className="mt-6">
            <label className="eyebrow">Selfie (optional)</label>
            <UploadCard
              label="Upload a selfie"
              hint="JPEG/PNG/WEBP · under 6MB"
              icon={Camera}
              accept="image/jpeg,image/png,image/webp"
              uploading={uploadingSelfie}
              file={selfie}
              onFile={handleSelfie}
              onClear={() => setSelfie(null)}
              testId="selfie"
              preview={selfie?.previewUrl}
            />
          </div>

          {/* Lab report upload */}
          <div className="mt-6">
            <label className="eyebrow">Lab / test report (optional)</label>
            <UploadCard
              label="Upload a lab report"
              hint="JPEG/PNG/WEBP or PDF · under 6MB"
              icon={FileText}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              uploading={uploadingLab}
              file={lab}
              onFile={handleLab}
              onClear={() => setLab(null)}
              testId="lab"
            />
          </div>

          {error && (
            <div className="mt-5 text-sm text-copper" data-testid="intake-step1-error">
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <span className="text-xs text-ink/50">
              {canProceedFromStep1 ? "Ready when you are" : "Add at least one input"}
            </span>
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedFromStep1}
              className="btn-primary"
              data-testid="intake-step1-next"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h2 className="font-display text-[26px] leading-[1.15] tracking-tight text-ink">
            A few quick details.
          </h2>
          <p className="text-[14px] text-ink/60 mt-2 leading-relaxed">
            Multi-select — tap all that apply.
          </p>

          <div className="mt-6 space-y-7">
            {mcqQuestions.map((q, qi) => (
              <div key={q.id} data-testid={`mcq-${q.id}`}>
                <div className="font-display text-[18px] leading-snug text-ink">
                  <span className="text-ink/40 mr-2 text-[14px] tabular-nums">
                    {String(qi + 1).padStart(2, "0")}
                  </span>
                  {q.prompt}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const selected = (answers[q.id] || []).includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleAnswer(q.id, opt.value)}
                        data-testid={`mcq-${q.id}-${opt.value}`}
                        className="px-4 py-2 rounded-full text-[13.5px] transition-colors border"
                        style={
                          selected
                            ? {
                                background: "#5C7A5A",
                                color: "#FAF7F0",
                                borderColor: "#5C7A5A",
                              }
                            : {
                                background: "#FFFFFF",
                                color: "#2B2B26",
                                borderColor: "rgba(58,79,58,0.18)",
                              }
                        }
                      >
                        {selected && <Check size={12} className="inline mr-1.5 -mt-0.5" />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <span className="text-xs text-ink/50">
              {answeredMcqCount} of {mcqQuestions.length} answered
            </span>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedFromStep2}
              className="btn-primary"
              data-testid="intake-step2-next"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h2 className="font-display text-[26px] leading-[1.15] tracking-tight text-ink">
            {q7?.prompt || "Anything else we should know?"}
          </h2>
          <p className="text-[14px] text-ink/60 mt-2 leading-relaxed">
            {q7?.helper ||
              "Please mention any allergies, blood pressure, diabetes, thyroid, PCOS/PCOD, medications or diagnosed conditions."}
          </p>

          <div className="mt-6 rounded-2xl bg-white border border-[#5C7A5A]/12 shadow-soft focus-within:border-[#5C7A5A]/40 transition-colors">
            <textarea
              data-testid="intake-medical-input"
              className="w-full bg-transparent outline-none text-[15px] text-ink placeholder:text-ink/35 resize-none min-h-[140px] p-4 leading-relaxed"
              placeholder="Optional — you can skip this."
              value={medicalText}
              onChange={(e) => setMedicalText(e.target.value)}
              maxLength={1500}
            />
          </div>
          <div className="text-right text-[10px] text-ink/40 mt-1">
            {medicalText.length}/1500 · Optional
          </div>

          {error && (
            <div className="mt-5 text-sm text-copper text-center" data-testid="intake-submit-error">
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="btn-ghost"
              data-testid="intake-step3-back"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              onClick={doSubmit}
              disabled={submitting}
              className="btn-primary"
              data-testid="intake-submit-btn"
            >
              {submitting ? "Reading your inputs…" : "Reveal my dosha read"}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function UploadCard({
  label,
  hint,
  icon: Icon,
  accept,
  uploading,
  file,
  onFile,
  onClear,
  testId,
  preview,
}) {
  const inputId = `upload-${testId}`;
  return (
    <div
      className="mt-2 rounded-2xl bg-white border border-dashed border-[#5C7A5A]/25 shadow-soft p-4"
      data-testid={`upload-${testId}`}
    >
      {file ? (
        <div className="flex items-center gap-3">
          {preview ? (
            <img
              src={preview}
              alt=""
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(92,122,90,0.08)", color: "#3A4F3A" }}
            >
              <Icon size={20} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[14px] text-ink truncate" data-testid={`${testId}-filename`}>
              {file.fileName}
            </div>
            <div className="text-[11px] text-ink/50 mt-0.5 flex items-center gap-1.5">
              <Check size={11} style={{ color: "#5C7A5A" }} />
              Uploaded
            </div>
          </div>
          <button
            onClick={onClear}
            className="w-9 h-9 rounded-full flex items-center justify-center text-ink/60 hover:bg-cream transition-colors"
            data-testid={`${testId}-clear-btn`}
            aria-label="Remove"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex items-center gap-3 cursor-pointer"
          data-testid={`${testId}-picker-label`}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(217,164,65,0.14)", color: "#B8632F" }}
          >
            {uploading ? (
              <span className="inline-block w-4 h-4 rounded-full border-2 border-[#B8632F] border-t-transparent animate-spin" />
            ) : (
              <Icon size={20} />
            )}
          </div>
          <div className="flex-1">
            <div className="text-[14px] text-ink">{label}</div>
            <div className="text-[11px] text-ink/50 mt-0.5">{hint}</div>
          </div>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-ink/50">
            <Upload size={15} />
          </div>
          <input
            id={inputId}
            data-testid={`${testId}-file-input`}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      )}
    </div>
  );
}
