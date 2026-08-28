import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Sunrise,
  Moon,
  CalendarDays,
  Leaf,
  Ban,
  Sparkles,
  Camera,
  FileText,
  Utensils,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Share2,
  Check,
  MapPin,
  Droplet,
  ChevronDown,
  Download,
} from "lucide-react";
import { getFullReport } from "../lib/api";
import DoshaDial from "./DoshaDial";

const TIME_ICON = { Morning: Sunrise, Evening: Moon, Weekly: CalendarDays };
const ORDER = ["vata", "pitta", "kapha"];
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Full paid report — vision-augmented, personalized. This is the actual
 * paid deliverable, so every section gets its own considered visual
 * treatment rather than one repeated white-card pattern, and the top
 * summary is built to be legible as a standalone shared/screenshotted card.
 */
export default function FullReport({ category, sessionId, onRestart, onSwitchCategory, unlockedMap }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  const [shareState, setShareState] = useState("idle"); // idle | copied
  const [downloadState, setDownloadState] = useState("idle"); // idle | working | error
  const reportRef = useRef(null);

  // The backend already caches the generated report in the database (a
  // repeat call skips Gemini entirely) — but the app still made a full
  // network round-trip and showed the "Crafting…" spinner every single time
  // this screen opened, even for a report generated minutes or days ago.
  // Caching it in localStorage too means a repeat visit renders instantly,
  // with a quiet background refresh to self-heal if anything ever changes.
  const cacheKey = `pdx_report_${sessionId}_${category}`;

  useEffect(() => {
    let cancelled = false;
    setError(null);

    let cachedLocal = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cachedLocal = JSON.parse(raw);
    } catch {
      /* localStorage unavailable or corrupted — fall through to a normal fetch */
    }

    if (cachedLocal) {
      setReport(cachedLocal);
      setLoading(false);
    } else {
      setLoading(true);
      setReport(null);
    }

    getFullReport({ session_id: sessionId, category })
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(r));
        } catch {
          /* storage full or unavailable — non-fatal, just skip caching */
        }
      })
      .catch((e) => {
        if (cancelled) return;
        // Don't clobber an already-showing cached report with an error over
        // what might just be a transient network hiccup in the background.
        if (cachedLocal) return;
        const detail = e?.response?.data?.detail || "";
        setError(
          e?.response?.status === 402
            ? "This report is locked until payment is confirmed."
            : detail || "Could not generate your report."
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sessionId, category, retryTick]);

  if (loading) {
    return (
      <div className="py-24 text-center" data-testid="report-loading">
        <div className="inline-block w-8 h-8 rounded-full border-2 border-[#5C7A5A] border-t-transparent animate-spin" />
        <div className="mt-4 text-sm text-ink/60">
          Crafting your personalized {category} report…
        </div>
        <div className="mt-1 text-[11px] text-ink/40">This can take 20–40 seconds.</div>
      </div>
    );
  }

  if (error || !report) {
    const isPaymentIssue = error === "This report is locked until payment is confirmed.";
    return (
      <div className="py-24 text-center" data-testid="report-error">
        <div className="text-ink/80 mb-4">{error}</div>
        <div className="flex flex-col gap-2 items-center">
          {!isPaymentIssue && (
            <button
              className="btn-primary"
              onClick={() => setRetryTick((t) => t + 1)}
              data-testid="report-retry-btn"
            >
              Try again
            </button>
          )}
          <button className="btn-ghost" onClick={onRestart}>
            Start over
          </button>
        </div>
      </div>
    );
  }

  const otherCat = category === "skin" ? "hair" : "skin";
  const otherUnlocked = unlockedMap?.[otherCat];

  const pct = report.dosha_breakdown || { vata: 34, pitta: 33, kapha: 33 };
  const orderedDoshas = ORDER.slice().sort((a, b) => (pct[b] || 0) - (pct[a] || 0));
  const secondary = orderedDoshas.find((d) => d !== report.dosha) || orderedDoshas[1];

  const handleShare = async () => {
    const text = `My ${category} constitution on PrakritiDx: ${pct[report.dosha] ?? 0}% ${cap(report.dosha)} · ${pct[secondary] ?? 0}% ${cap(secondary)}. Know yours too.`;
    const url = typeof window !== "undefined" ? window.location.origin : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: "My PrakritiDx Constitution", text, url });
      } catch {
        /* user cancelled share sheet — no-op */
      }
      return;
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2200);
      } catch {
        /* clipboard unavailable — silently ignore */
      }
    }
  };

  const handleDownload = async () => {
    if (!reportRef.current || downloadState === "working") return;
    setDownloadState("working");
    try {
      // Dynamically imported so these two libraries only load when someone
      // actually taps Download, not as part of the main app bundle.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const el = reportRef.current;
      const canvas = await html2canvas(el, {
        backgroundColor: "#FAF7F0",
        scale: 2, // retina-quality output
        useCORS: true,
        windowWidth: el.scrollWidth,
      });

      // Single continuous page sized to the content's own aspect ratio —
      // simpler and more reliable than paginating a tall report across
      // fixed A4 pages, and avoids content getting cut mid-section.
      const imgData = canvas.toDataURL("image/png");
      const pageWidthMM = 210;
      const pageHeightMM = (canvas.height * pageWidthMM) / canvas.width;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageWidthMM, pageHeightMM],
      });
      pdf.addImage(imgData, "PNG", 0, 0, pageWidthMM, pageHeightMM);

      const namePart = report.user_name ? `-${report.user_name.replace(/\s+/g, "_")}` : "";
      pdf.save(`PrakritiDx-${category}-report${namePart}.pdf`);
      setDownloadState("idle");
    } catch (e) {
      console.error("PDF generation failed", e);
      setDownloadState("error");
      setTimeout(() => setDownloadState("idle"), 2500);
    }
  };

  return (
    <div className="pb-10" data-testid={`report-${category}`} ref={reportRef}>
      {/* Header */}
      <div className="text-center pt-2">
        {report.user_name && (
          <div className="text-[13px] text-ink/50 mb-1.5" data-testid="report-greeting">
            Hi {report.user_name},
          </div>
        )}
        <span className="eyebrow">Your full {category} report</span>
      </div>

      {/* Shareable summary card — framed distinctly so it reads well on its
          own if screenshotted or shared */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mt-6 rounded-[28px] p-6 flex flex-col items-center relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #FBF6E8 100%)",
          border: "1px solid rgba(217,164,65,0.35)",
          boxShadow: "0 16px 40px rgba(43,43,38,0.08)",
        }}
        data-testid="report-share-card"
      >
        <div
          className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[9.5px] font-medium tracking-widest uppercase text-ink shadow-soft"
          style={{ background: "#D9A441" }}
          data-testid="report-unlocked-badge"
        >
          Unlocked
        </div>

        <DoshaDial
          breakdown={report.dosha_breakdown}
          dominant={report.dosha}
          dominantLabel={report.dosha_label}
        />
        <h1 className="font-display text-[32px] leading-tight tracking-tight text-ink mt-6 text-center" data-testid="report-dosha">
          {report.dosha_label}-leaning
        </h1>
        <p className="text-[12.5px] text-ink/50 mt-1 text-center capitalize">
          {category} constitution
        </p>

        <div className="mt-5 flex items-center gap-2.5 no-print" data-html2canvas-ignore="true">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-medium border transition-colors"
            style={{
              borderColor: "rgba(184,99,47,0.35)",
              color: "#B8632F",
              background: "rgba(255,255,255,0.6)",
            }}
            data-testid="report-share-btn"
          >
            {shareState === "copied" ? (
              <>
                <Check size={13} />
                Copied
              </>
            ) : (
              <>
                <Share2 size={13} />
                Share
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloadState === "working"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-medium border transition-colors disabled:opacity-60"
            style={{
              borderColor:
                downloadState === "error" ? "rgba(184,99,47,0.5)" : "rgba(92,122,90,0.30)",
              color: downloadState === "error" ? "#B8632F" : "#3A4F3A",
              background: "rgba(255,255,255,0.6)",
            }}
            data-testid="report-download-btn"
          >
            {downloadState === "working" ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Preparing…
              </>
            ) : downloadState === "error" ? (
              <>
                <Download size={13} />
                Try again
              </>
            ) : (
              <>
                <Download size={13} />
                Download
              </>
            )}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-ink/35">
          <span>PrakritiDx</span>
          <span>·</span>
          <span>Ayurveda + Modern Science</span>
        </div>
      </motion.div>

      {/* Constitution read */}
      <Card testId="report-constitution" className="mt-6">
        <Eyebrow>Your Constitution</Eyebrow>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/85">
          {report.constitution_read}
        </p>
      </Card>

      {/* Vision & lab notes */}
      {(report.vision_notes || report.lab_notes) && (
        <div className="grid grid-cols-1 gap-3 mt-4">
          {report.vision_notes && (
            <Card testId="report-vision">
              <div className="flex items-center gap-2">
                <Camera size={14} style={{ color: "#B8632F" }} />
                <Eyebrow>Selfie observations</Eyebrow>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/80">
                {report.vision_notes}
              </p>
            </Card>
          )}
          {report.lab_notes && (
            <Card testId="report-lab">
              <div className="flex items-center gap-2">
                <FileText size={14} style={{ color: "#B8632F" }} />
                <Eyebrow>Lab report signals</Eyebrow>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/80">
                {report.lab_notes}
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Routine — connected step-by-step timeline */}
      <SectionHeader title="Your Daily Rhythm" subtitle="Step by step, precisely tuned" className="mt-10" />
      <div className="mt-5 relative">
        {/* connecting line */}
        <div
          className="absolute left-5 top-2 bottom-2 w-px"
          style={{ background: "rgba(92,122,90,0.18)" }}
        />
        <div className="space-y-5">
          {report.routine?.map((s, i) => {
            const Icon = TIME_ICON[s.time] || Sunrise;
            const hasPrep = s.prep && s.prep.trim().length > 0;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
                className="relative pl-14"
                data-testid={`routine-step-${i}`}
              >
                <div
                  className="absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                  style={{ background: "#FAF7F0", border: "2px solid rgba(92,122,90,0.25)", color: "#3A4F3A" }}
                >
                  <Icon size={17} />
                </div>
                <div className="rounded-2xl bg-white p-4 border border-[#5C7A5A]/10 shadow-soft">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] tracking-widest uppercase text-ink/50">
                      {s.time} · Step {i + 1}
                    </div>
                  </div>
                  <div className="font-display text-[17px] text-ink leading-snug mt-1">
                    {s.step}
                  </div>
                  <div className="text-[13px] text-ink/60 mt-1.5 leading-relaxed">
                    {s.why}
                  </div>
                  {hasPrep && (
                    <details className="mt-3 group">
                      <summary
                        className="flex items-center gap-1.5 cursor-pointer list-none text-[12px] font-medium"
                        style={{ color: "#B8632F" }}
                      >
                        <Droplet size={12} />
                        How to prepare & use
                        <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
                      </summary>
                      <p
                        className="mt-2 text-[13px] leading-relaxed text-ink/75 rounded-xl p-3"
                        style={{ background: "rgba(217,164,65,0.10)" }}
                        data-testid={`routine-prep-${i}`}
                      >
                        {s.prep}
                      </p>
                    </details>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Key ingredients — 2-column grid */}
      <SectionHeader title="Key Ingredients" subtitle="Ayurvedic + modern, with how & where" className="mt-10" />
      <div className="mt-5 grid grid-cols-2 gap-3">
        {report.key_ingredients?.map((ing, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white p-3.5 border border-[#5C7A5A]/10 shadow-soft"
            data-testid={`ingredient-${i}`}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(217,164,65,0.14)", color: "#B8632F" }}
            >
              <Leaf size={13} />
            </div>
            <div className="font-display text-[14.5px] text-ink leading-snug mt-2">
              {ing.name}
            </div>
            <div className="text-[11.5px] text-ink/55 mt-1 leading-snug">
              {ing.role}
            </div>
            {ing.how_to_use && (
              <div className="text-[11px] text-ink/70 mt-2 leading-snug">
                <span className="font-medium" style={{ color: "#3A4F3A" }}>Use: </span>
                {ing.how_to_use}
              </div>
            )}
            {ing.where_to_get && (
              <div className="flex items-start gap-1 text-[10.5px] text-ink/45 mt-1.5 leading-snug">
                <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                <span>{ing.where_to_get}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Diet — tinted split panels with benefit/harm per item */}
      {report.diet && (
        <>
          <SectionHeader title="Diet" subtitle="What to favour and reduce, and why" className="mt-10" />
          <div className="grid grid-cols-1 gap-3 mt-5">
            <div
              className="rounded-2xl p-5"
              style={{ background: "rgba(92,122,90,0.08)", border: "1px solid rgba(92,122,90,0.18)" }}
              data-testid="diet-favor"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(92,122,90,0.20)", color: "#3A4F3A" }}
                >
                  <Utensils size={12} />
                </div>
                <span className="font-display text-[16px] text-ink">Favour</span>
              </div>
              <ul className="space-y-2.5">
                {report.diet.favor?.map((f, i) => {
                  const item = typeof f === "string" ? f : f.item;
                  const benefit = typeof f === "string" ? null : f.benefit;
                  return (
                    <li key={i} className="text-[13.5px] leading-relaxed" data-testid={`diet-favor-${i}`}>
                      <div className="flex gap-2 text-ink/85">
                        <span style={{ color: "#5C7A5A" }}>·</span>
                        <span className="font-medium">{item}</span>
                      </div>
                      {benefit && (
                        <div className="text-[12px] text-ink/55 pl-4 mt-0.5 leading-snug">
                          {benefit}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div
              className="rounded-2xl p-5"
              style={{ background: "rgba(184,99,47,0.07)", border: "1px solid rgba(184,99,47,0.20)" }}
              data-testid="diet-reduce"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(184,99,47,0.18)", color: "#B8632F" }}
                >
                  <Ban size={12} />
                </div>
                <span className="font-display text-[16px] text-ink">Reduce</span>
              </div>
              <ul className="space-y-2.5">
                {report.diet.reduce?.map((f, i) => {
                  const item = typeof f === "string" ? f : f.item;
                  const harm = typeof f === "string" ? null : f.harm;
                  return (
                    <li key={i} className="text-[13.5px] leading-relaxed" data-testid={`diet-reduce-${i}`}>
                      <div className="flex gap-2 text-ink/85">
                        <span style={{ color: "#B8632F" }}>·</span>
                        <span className="font-medium">{item}</span>
                      </div>
                      {harm && (
                        <div className="text-[12px] text-ink/55 pl-4 mt-0.5 leading-snug">
                          {harm}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}

      {/* Daily practice */}
      {report.daily_practice?.length > 0 && (
        <>
          <SectionHeader title="Daily Practice" subtitle="Habits to build" className="mt-10" />
          <Card testId="daily-practice" className="mt-5">
            <ul className="space-y-2">
              {report.daily_practice.map((p, i) => (
                <li
                  key={i}
                  className="text-[13.5px] text-ink/80 leading-relaxed flex gap-2"
                  data-testid={`daily-practice-${i}`}
                >
                  <span style={{ color: "#5C7A5A" }}>·</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {/* Avoid — small cards with disadvantage explained */}
      {report.avoid?.length > 0 && (
        <>
          <SectionHeader title="Avoid" subtitle="And what happens if you don't" className="mt-10" />
          <div className="mt-5 space-y-2.5">
            {report.avoid.map((a, i) => {
              const item = typeof a === "string" ? a : a.item;
              const disadvantage = typeof a === "string" ? null : a.disadvantage;
              return (
                <div
                  key={i}
                  className="rounded-xl bg-white p-3.5 flex gap-2.5"
                  style={{ border: "1px solid rgba(184,99,47,0.20)" }}
                  data-testid={`avoid-${i}`}
                >
                  <Ban size={14} style={{ color: "#B8632F" }} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[13.5px] text-ink font-medium leading-snug">{item}</div>
                    {disadvantage && (
                      <div className="text-[12px] text-ink/55 mt-1 leading-snug">{disadvantage}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Herbs — renamed, distinct apothecary-label style */}
      {report.herbs?.length > 0 && (
        <>
          <SectionHeader
            title="Extra Ayurvedic Herbs for Extra Benefits"
            subtitle="Beyond the essentials"
            className="mt-10"
          />
          <div className="mt-5 space-y-3">
            {report.herbs.map((h, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 relative"
                style={{
                  background: "#FBF6E8",
                  border: "1px dashed rgba(217,164,65,0.55)",
                }}
                data-testid={`herb-${i}`}
              >
                <div className="flex items-center gap-2">
                  <Leaf size={13} style={{ color: "#B8632F" }} />
                  <span className="font-display text-[17px] text-ink">{h.name}</span>
                  <span className="text-[9.5px] tracking-widest uppercase gold-underline ml-auto" style={{ color: "#B8632F" }}>
                    Herb
                  </span>
                </div>
                <p className="text-[13px] text-ink/70 mt-2 leading-relaxed">{h.usage}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Conclusion */}
      {report.conclusion && (
        <div
          className="mt-10 rounded-[24px] p-6 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(92,122,90,0.10) 0%, rgba(217,164,65,0.10) 100%)",
            border: "1px solid rgba(217,164,65,0.30)",
          }}
          data-testid="report-conclusion"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} style={{ color: "#B8632F" }} />
            <Eyebrow>In Summary</Eyebrow>
          </div>
          <p className="font-display text-[16px] leading-relaxed text-ink/90">
            {report.conclusion}
          </p>
        </div>
      )}

      {/* When to see doctor */}
      {report.when_to_see_doctor?.length > 0 && (
        <div
          className="mt-6 rounded-2xl p-5"
          style={{ background: "rgba(184,99,47,0.09)", border: "1px solid rgba(184,99,47,0.30)" }}
          data-testid="see-doctor"
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "rgba(184,99,47,0.18)", color: "#B8632F" }}
            >
              <AlertTriangle size={12} />
            </div>
            <span className="font-display text-[16px] text-ink">When to see a doctor</span>
          </div>
          <ul className="space-y-1.5">
            {report.when_to_see_doctor.map((w, i) => (
              <li
                key={i}
                className="text-[13.5px] text-ink/80 leading-relaxed flex gap-2"
                data-testid={`see-doctor-${i}`}
              >
                <span style={{ color: "#B8632F" }}>·</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Combo cross-sell / cross-nav */}
      <div className="mt-12 no-print" data-html2canvas-ignore="true">
        <div className="gold-divider mb-6" />
        {otherUnlocked ? (
          <button
            onClick={() => onSwitchCategory(otherCat)}
            className="btn-primary justify-center w-full"
            data-testid="switch-to-other-report"
          >
            <Sparkles size={16} />
            View your {otherCat} report
            <ArrowRight size={16} />
          </button>
        ) : (
          <div
            className="rounded-2xl bg-white p-5 border border-[#5C7A5A]/12 shadow-soft"
            data-testid="cross-sell"
          >
            <div className="font-display text-[17px] text-ink leading-snug">
              Also curious about your {otherCat} constitution?
            </div>
            <p className="text-[13px] text-ink/60 mt-1.5 leading-relaxed">
              Switch tabs at the top to complete your {otherCat} intake. Combo customers already have it unlocked.
            </p>
            <button
              onClick={() => onSwitchCategory(otherCat)}
              className="btn-ghost mt-4"
              data-testid="switch-cat-btn"
            >
              Go to {otherCat}
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        <button
          onClick={onRestart}
          className="btn-ghost justify-center w-full mt-3"
          data-testid="report-restart-btn"
        >
          <RotateCcw size={13} />
          Redo my {category} intake
        </button>
      </div>

      <p className="mt-8 text-[11px] text-ink/45 text-center leading-relaxed">
        Guidance is educational and not a substitute for medical advice.
        Patch-test new ingredients.
      </p>
    </div>
  );
}

function Card({ children, testId, className = "" }) {
  return (
    <div
      className={`rounded-2xl bg-white p-6 border border-[#5C7A5A]/10 shadow-soft ${className}`}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }) {
  return <span className="eyebrow">{children}</span>;
}

function SectionHeader({ title, subtitle, className = "" }) {
  return (
    <div className={className}>
      <Eyebrow>{title}</Eyebrow>
      <div className="font-display text-[22px] text-ink leading-tight mt-1">
        {subtitle}
      </div>
    </div>
  );
}
