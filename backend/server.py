"""
PrakritiDx Backend — v2
- Chat + selfie + lab report + fixed MCQ intake
- Medical urgency HARD-BLOCK safety check
- Free hook (static frame + AI teaser)
- Razorpay Payment Links (test mode) gate
- Post-payment: full AI report (with Gemini vision on selfie + lab report)
"""
import os
import json
import uuid
import base64
import hmac
import hashlib
import logging
import asyncio
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from typing import Optional, Literal, List, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

from google import genai  # noqa: E402
from google.genai import types as genai_types  # noqa: E402
import razorpay  # noqa: E402

from safety import check_medical_urgency, BLOCK_MESSAGE  # noqa: E402
from intake import get_questions  # noqa: E402

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("prakritidx")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "").strip()
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "")
GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS", "").strip()
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

# Model name — Gemini's free tier (via Google AI Studio) currently covers Flash-class
# models. Bump this here if Google moves the free tier to a newer Flash model.
GEMINI_MODEL = "gemini-3.5-flash"
# Fallback used only if the primary model returns a server-side error (e.g. 503
# UNAVAILABLE under high demand) or an unparseable response. gemini-3.5-flash-lite
# is a separate, cost/high-volume-optimized model in the current generation —
# likely to have separate capacity from the primary model, and (unlike older
# generations) confirmed available to newly created Gemini projects.
GEMINI_MODEL_FALLBACK = "gemini-3.5-flash-lite"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# Razorpay client — created lazily so the app boots even without keys set.
_rzp_client = None


def rzp() -> razorpay.Client:
    global _rzp_client
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
        )
    if _rzp_client is None:
        _rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    return _rzp_client


app = FastAPI(title="PrakritiDx API", version="2.0.0")
api = APIRouter(prefix="/api")

Category = Literal["skin", "hair"]


# -----------------------------------------------------------------------------
# Pricing (in paise for Razorpay — but shown to user as rupees)
# -----------------------------------------------------------------------------
PRICE_SINGLE_PAISE = 9900  # ₹99
PRICE_COMBO_PAISE = 14900  # ₹149

PRODUCT_LABEL = {
    "single": "PrakritiDx — Full Report (Single)",
    "combo": "PrakritiDx — Combo Report (Skin + Hair)",
}


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class IntakeAnswer(BaseModel):
    question_id: str
    values: List[str] = []          # multi-select values
    free_text: Optional[str] = None  # for q7


class IntakeSubmit(BaseModel):
    session_id: str = Field(..., min_length=1)
    category: Category
    name: Optional[str] = None
    chat_text: Optional[str] = None
    answers: List[IntakeAnswer] = []
    selfie_upload_id: Optional[str] = None
    lab_upload_id: Optional[str] = None


class PaymentCreate(BaseModel):
    session_id: str
    plan: Literal["single", "combo"]
    category: Category  # the section they're currently in (which unlocks after single)


class ReportRequest(BaseModel):
    session_id: str
    category: Category
    regenerate: bool = False


class EmailReportRequest(BaseModel):
    session_id: str
    category: Category
    email: str


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _send_report_email(to_email: str, report: Dict[str, Any], restore_url: str) -> bool:
    """Sends a 'save your report' email with a magic restore link. This is
    the actual fix for access recovery: a paid report's unlock status lives
    only in the browser's local storage, tied to an anonymous session id —
    lose the device or clear storage and there was previously no way back
    in. The restore link re-seeds that same session id in a fresh browser,
    so tapping it from any device lands the person straight back on their
    already-unlocked, already-generated report.
    Runs synchronously (blocking SMTP) — callers should invoke this via
    asyncio.to_thread so it doesn't block the event loop.
    """
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        logger.error("Email not configured — missing GMAIL_ADDRESS/GMAIL_APP_PASSWORD")
        return False

    name = report.get("user_name") or "there"
    category = report.get("category", "")
    dosha_label = report.get("dosha_label", "")

    html = f"""
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 28px; color: #2B2B26; background: #FAF7F0;">
      <div style="font-size: 20px; font-weight: bold; margin-bottom: 4px;">
        Prakriti<span style="color:#B8632F;">Dx</span>
      </div>
      <p style="font-size: 15px; margin-top: 24px;">Hi {name},</p>
      <p style="font-size: 15px; line-height: 1.6;">
        Your <strong>{dosha_label}-leaning {category}</strong> constitution report is saved and ready
        whenever you need it — on this device or any other.
      </p>
      <p style="margin: 28px 0;">
        <a href="{restore_url}"
           style="background:#3A4F3A;color:#FAF7F0;padding:13px 26px;border-radius:999px;
                  text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;">
          View my full report
        </a>
      </p>
      <p style="font-size: 12.5px; color: #8a8a80; line-height: 1.5;">
        This link works on any device or browser — keep this email as your permanent
        way back in. No account or login needed.
      </p>
      <hr style="border:none;border-top:1px solid #e5ddc8;margin:24px 0 16px;" />
      <p style="font-size: 11px; color: #a8a290; line-height: 1.5;">
        This email was requested via PrakritiDx by someone completing a personalized
        {category} report. If you weren't expecting this, you can safely ignore it —
        no action is needed and you won't be contacted again unless someone
        requests it here again.
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your PrakritiDx {category} report"
    msg["From"] = f"PrakritiDx <{GMAIL_ADDRESS}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_ADDRESS, [to_email], msg.as_string())
        return True
    except Exception:
        logger.exception("Failed to send report email")
        return False


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_intake(session_id: str, category: str) -> Optional[Dict[str, Any]]:
    doc = await db.intakes.find_one({"session_id": session_id, "category": category})
    if doc:
        doc.pop("_id", None)
    return doc


def _collect_free_text(intake: Dict[str, Any]) -> List[str]:
    fields = [intake.get("chat_text") or ""]
    for ans in intake.get("answers", []):
        if ans.get("free_text"):
            fields.append(ans["free_text"])
    return fields


# Deterministic static dosha hook frames — 2 sentences of setup, AI generates 1 teaser sentence at end.
DOSHA_HINTS = {
    "skin": {
        "vata": {
            "signals": ["dryness_cracks", "flaky", "cold_dry", "lack_of_sleep", "under_1m", "cyclical", "around_eyes"],
            "frame": "Your inputs are pointing toward a Vata-leaning skin pattern — dry, delicate, reactive to weather and irregular sleep. Vata skin thrives on grounding oils, warmth, and consistent rhythm.",
        },
        "pitta": {
            "signals": ["red_bumps", "pigmentation", "stress", "hot_humid", "spicy_oily_food", "acid_reflux", "cheeks", "hormonal"],
            "frame": "Your inputs are pointing toward a Pitta-leaning skin pattern — heat, inflammation, and reactivity to stress and spicy food. Pitta skin needs cooling, calming, and blood-purifying care.",
        },
        "kapha": {
            "signals": ["oily_shine", "rough_bumpy", "tzone", "back_chest", "2y_plus", "bloating", "constipation"],
            "frame": "Your inputs are pointing toward a Kapha-leaning skin pattern — heaviness, congestion, and slow-moving oil buildup. Kapha skin needs stimulation, detox, and lighter routines.",
        },
    },
    "hair": {
        "vata": {
            "signals": ["dry_itchy", "split_breakage", "diffuse", "seasonal", "seasonal_change", "cold_dry"],
            "frame": "Your inputs are pointing toward a Vata-leaning hair pattern — dryness, frizz, and fragility that shifts with the seasons. Vata hair needs deep oiling, warmth, and consistent nourishment.",
        },
        "pitta": {
            "signals": ["receding", "crown_thinning", "high_stress", "post_illness", "postpartum_hormonal", "acid_reflux"],
            "frame": "Your inputs are pointing toward a Pitta-leaning hair pattern — thinning, early greying, and stress-triggered shedding. Pitta hair needs cooling scalp care and calming rituals.",
        },
        "kapha": {
            "signals": ["oily_day2", "dandruff", "visible_scalp", "shedding", "poor_diet", "bloating", "constipation"],
            "frame": "Your inputs are pointing toward a Kapha-leaning hair pattern — heavy roots, oiliness, and dandruff-prone scalp. Kapha hair needs clarifying, stimulation, and lightness.",
        },
    },
}


def _dosha_breakdown_from_intake(category: str, intake: Dict[str, Any]) -> Dict[str, Any]:
    """Scores each dosha by how many selected multi-select values match its
    signal set, then converts to a percentage breakdown across all three —
    real Ayurvedic constitution is usually a blend, not a single label, so
    this is what actually powers the dosha balance dial on the frontend.
    Returns {"dominant": <dosha>, "breakdown": {"vata": int, "pitta": int, "kapha": int}}
    with the three percentages always summing to exactly 100.
    """
    hints = DOSHA_HINTS[category]
    picked_values: List[str] = []
    for a in intake.get("answers", []):
        picked_values.extend(a.get("values") or [])
    scores = {"vata": 0, "pitta": 0, "kapha": 0}
    for dosha, meta in hints.items():
        for v in meta["signals"]:
            if v in picked_values:
                scores[dosha] += 1

    total = sum(scores.values())
    if total == 0:
        # No signal matches at all (e.g. only free-text was given) — fall
        # back to a near-even split rather than dividing by zero. Order
        # still respects the vata > pitta > kapha tie-break used elsewhere.
        pct = {"vata": 34, "pitta": 33, "kapha": 33}
    else:
        raw = {k: (v / total) * 100 for k, v in scores.items()}
        floored = {k: int(v) for k, v in raw.items()}
        remainder = 100 - sum(floored.values())
        # Distribute any leftover percentage points (from flooring) to the
        # doshas with the largest fractional remainder, so the three always
        # sum to exactly 100 instead of e.g. 99 or 101.
        by_fraction = sorted(raw.items(), key=lambda x: -(x[1] - int(x[1])))
        for i in range(remainder):
            floored[by_fraction[i][0]] += 1
        pct = floored

    ordered = sorted(pct.items(), key=lambda x: (-x[1], ["vata", "pitta", "kapha"].index(x[0])))
    dominant = ordered[0][0]
    return {"dominant": dominant, "breakdown": pct}


def _tally_dosha_from_intake(category: str, intake: Dict[str, Any]) -> str:
    """Back-compat wrapper — returns just the dominant dosha string."""
    return _dosha_breakdown_from_intake(category, intake)["dominant"]


def _is_transient_gemini_error(e: Exception) -> bool:
    """True for errors worth retrying: rate limits (429) and momentary server-side
    overload (503 UNAVAILABLE). False for genuinely bad requests, which should
    fail immediately instead of being retried."""
    msg = str(e).lower()
    return (
        "429" in msg or "resource_exhausted" in msg or "rate limit" in msg or "quota" in msg
        or "503" in msg or "unavailable" in msg or "high demand" in msg
    )


async def _call_gemini_with_retry(**kwargs):
    """
    Call Gemini with retry + exponential backoff on transient errors (rate limits
    or momentary server overload). If the primary model keeps failing after all
    retries, fall back once to GEMINI_MODEL_FALLBACK — a more established model
    less likely to be hit by the same demand spike — before giving up entirely.
    Worst case: ~3 retries on the primary (~13s) + 1 attempt on the fallback,
    so a paying user isn't left staring at an instant failure from a momentary
    limit or outage on one specific model.
    """
    delays = [2, 4, 8]  # seconds, exponential backoff
    primary_model = kwargs.get("model")
    last_exc = None
    for attempt, delay in enumerate([0] + delays):
        if delay:
            await asyncio.sleep(delay)
        try:
            return await gemini_client.aio.models.generate_content(**kwargs)
        except Exception as e:
            last_exc = e
            if not _is_transient_gemini_error(e):
                raise
            logger.warning("Gemini transient error on %s (attempt %d/%d): %s", primary_model, attempt + 1, len(delays) + 1, e)

    # Primary model exhausted its retries — try the fallback model once, if one
    # is configured and different from the model that just failed.
    if primary_model and GEMINI_MODEL_FALLBACK and primary_model != GEMINI_MODEL_FALLBACK:
        logger.warning("Falling back to %s after %s failed all retries", GEMINI_MODEL_FALLBACK, primary_model)
        fallback_kwargs = {**kwargs, "model": GEMINI_MODEL_FALLBACK}
        try:
            return await gemini_client.aio.models.generate_content(**fallback_kwargs)
        except Exception as e:
            logger.warning("Fallback model %s also failed: %s", GEMINI_MODEL_FALLBACK, e)
            last_exc = e

    raise last_exc


async def _generate_teaser_line(category: str, dosha: str, intake: Dict[str, Any]) -> str:
    """One-sentence AI teaser — deliberately withholds the routine."""
    prompt = (
        f"The user's {category} constitution reads as {dosha.capitalize()}-leaning. "
        f"Their chat description was: {(intake.get('chat_text') or '(none)')[:400]}\n\n"
        f"Write ONE short, warm, curiosity-building sentence (max 22 words) that hints at what their "
        f"full personalized routine will address — but does NOT give away specific ingredients, steps, "
        f"or diet advice. No lists. No colons. No em-dashes at the start. Return only the sentence."
    )
    try:
        resp = await _call_gemini_with_retry(
            model=GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction="You write concise, elegant, curiosity-piquing wellness copy.",
                max_output_tokens=100,
            ),
        )
        line = (resp.text or "").strip().strip('"').strip("'")
        # keep it as a single sentence
        if "." in line:
            line = line.split(".")[0].strip() + "."
        return line
    except Exception:
        return "Your full report will map the exact rituals, ingredients, and diet shifts your constitution is asking for."


async def _generate_full_report(category: str, dosha: str, intake: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate the FULL paid report using Gemini vision if selfie/lab report are attached.
    Returns structured JSON.
    """
    selfie_b64 = intake.get("selfie_b64")
    selfie_mime = intake.get("selfie_mime") or "image/jpeg"
    lab_b64 = intake.get("lab_b64")
    lab_mime = intake.get("lab_mime")

    surface = "skin" if category == "skin" else "scalp & hair"

    picked = []
    for a in intake.get("answers", []):
        if a.get("values"):
            picked.append(f"{a['question_id']}: {', '.join(a['values'])}")
        if a.get("free_text"):
            picked.append(f"{a['question_id']} (free text): {a['free_text'][:300]}")

    chat_text = intake.get("chat_text") or "(none)"

    system_prompt = (
        "You are a senior Ayurvedic consultant blending classical Ayurveda with modern dermatology "
        "and trichology. When a selfie is attached, briefly analyze visible signs (dryness, oiliness, "
        "redness, texture, scalp visibility, hair density) as an input. When a lab/test report is "
        "attached, extract any relevant findings (thyroid, hemoglobin, vitamin D/B12, hormones, "
        "inflammatory markers, glucose) and factor them into the recommendation. Never diagnose. "
        "Never recommend prescription medication. Speak with warmth and precision."
    )

    user_text = f"""Constitution: {dosha.capitalize()}-leaning for {surface}.

USER-REPORTED CHAT:
{chat_text[:800]}

USER-SELECTED MCQ:
{chr(10).join(picked) if picked else '(none provided)'}

Return ONLY valid JSON (no markdown, no code fences) matching exactly this shape:
{{
  "vision_notes": "1-2 sentence summary of what the selfie shows, or empty string if no selfie",
  "lab_notes": "1-2 sentence summary of relevant lab findings, or empty string if no lab report",
  "constitution_read": "3-4 sentence explanation of what this dosha means for their {surface} + what's likely driving THEIR specific presentation",
  "routine": [
    {{
      "time": "Morning",
      "step": "Concise step",
      "why": "One-line Ayurvedic + modern reason",
      "prep": "If this step is a face mask, mist, or other prepared remedy: how to prepare it (ingredients + method) and how to apply/use it. Empty string if the step needs no separate preparation (e.g. 'cleanse with lukewarm water')."
    }},
    {{"time": "Evening", "step": "...", "why": "...", "prep": "..."}},
    {{"time": "Weekly", "step": "...", "why": "...", "prep": "..."}}
  ],
  "key_ingredients": [
    {{
      "name": "Ingredient",
      "role": "What it does for this dosha",
      "how_to_use": "Concrete instructions: how much, how often, and in what form (e.g. 'Mix 1 tsp powder with rosewater, apply as a 10-minute mask twice a week')",
      "where_to_get": "Where someone in India would realistically source this (e.g. 'Ayurvedic pharmacy or Amazon/Nykaa — look for cold-pressed, unrefined')"
    }}
  ],
  "diet": {{
    "favor": [
      {{"item": "food/practice", "benefit": "Why this specifically helps their dosha and presentation"}}
    ],
    "reduce": [
      {{"item": "food/practice", "harm": "Why this specifically aggravates their dosha and presentation"}}
    ]
  }},
  "daily_practice": [
    "Actionable daily/weekly habit specific to their constitution and presentation"
  ],
  "avoid": [
    {{"item": "Specific ingredient/practice to avoid based on their intake", "disadvantage": "What it actually does to worsen their specific presentation"}}
  ],
  "herbs": [
    {{"name": "Herb", "usage": "How to use it — internal or topical"}}
  ],
  "conclusion": "3-4 sentence wrap-up: summarize their specific constitution and presentation in plain terms, reinforce the single most important thing they should focus on first, and end on an encouraging, confident note.",
  "when_to_see_doctor": ["Specific escalation signal (e.g. 'if breakouts turn painful and warm')"]
}}

Constraints:
- routine: 5-7 items covering Morning, Evening, and Weekly. Include "prep" details for AT LEAST 1-2 steps that are masks, mists, oils, or other prepared remedies — this is a paid report, so preparation instructions must be genuinely usable, not vague.
- key_ingredients: 5-7 items with real Ayurvedic + modern names, each with concrete how_to_use and realistic where_to_get guidance.
- diet.favor: 5-8 items, each with a specific benefit tied to their dosha; diet.reduce: 4-6 items, each with a specific harm tied to their dosha.
- daily_practice: 4-6 items.
- avoid: 4-6 items, each with a specific disadvantage explaining the real effect of not avoiding it.
- herbs: 3-5 items.
- conclusion: exactly one paragraph, 3-4 sentences.
- when_to_see_doctor: 2-4 items.
- Be concrete: name specific ingredients (e.g. "sandalwood powder", "bhringraj oil").
- Personalise based on the user's chat and MCQ answers — do not give a generic dosha report.
"""

    # Build message content: text prompt + any images/documents. Gemini reads
    # image-format lab reports as images, and PDF lab reports natively as
    # documents (page-by-page vision) — nothing gets silently dropped.
    content_parts: List[Any] = []
    if selfie_b64:
        content_parts.append(
            genai_types.Part.from_bytes(data=base64.b64decode(selfie_b64), mime_type=selfie_mime)
        )
    if lab_b64 and lab_mime:
        if lab_mime.startswith("image/") or lab_mime == "application/pdf":
            content_parts.append(
                genai_types.Part.from_bytes(data=base64.b64decode(lab_b64), mime_type=lab_mime)
            )
    content_parts.append(user_text)

    gen_config = genai_types.GenerateContentConfig(
        system_instruction=system_prompt,
        # The schema now includes prep instructions, how-to-use/where-to-get
        # per ingredient, and benefit/harm text per diet & avoid item — roughly
        # double the previous field count. Raised well past the 4000 that was
        # already tight for the smaller schema, so a verbose model's output
        # isn't silently cut off before the closing braces.
        max_output_tokens=7000,
        response_mime_type="application/json",
    )

    # Try the primary model, then — if its output can't be parsed as JSON
    # (not just a network/server error, which _call_gemini_with_retry already
    # handles) — retry the whole generation once on the fallback model. A
    # malformed response is rare but not impossible on a newer model, and it's
    # a shame to fail a paid report over one bad generation when a retry on a
    # more established model usually succeeds.
    models_to_try = [GEMINI_MODEL]
    if GEMINI_MODEL_FALLBACK and GEMINI_MODEL_FALLBACK != GEMINI_MODEL:
        models_to_try.append(GEMINI_MODEL_FALLBACK)

    last_error: Optional[Exception] = None
    for model_name in models_to_try:
        try:
            response = await _call_gemini_with_retry(
                model=model_name,
                contents=content_parts,
                config=gen_config,
            )
        except Exception as e:
            logger.exception("Gemini report generation failed on %s after retries", model_name)
            last_error = e
            continue

        text = (response.text or "").strip()

        # Strip code fences if any
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start, end = text.find("{"), text.rfind("}")
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end + 1])
                except json.JSONDecodeError:
                    pass
            # Log the raw text (truncated) so a recurrence is actually
            # diagnosable instead of just showing a generic failure message.
            logger.error(
                "Gemini response from %s could not be parsed as JSON. Raw text (first 1500 chars): %r",
                model_name, text[:1500],
            )
            last_error = ValueError(f"unparseable JSON from {model_name}")
            continue

    raise HTTPException(
        503,
        "Our AI is briefly overloaded generating your report. Your payment is safe — "
        "please tap to try again in a moment.",
    ) from last_error


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@api.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "prakritidx",
        "razorpay_configured": bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET),
        "time": _now(),
    }


@api.get("/intake/{category}")
async def get_intake_schema(category: Category):
    return {"category": category, "questions": get_questions(category)}


# ---- Uploads ---------------------------------------------------------------
_ALLOWED_IMG = {"image/jpeg", "image/png", "image/webp"}
_ALLOWED_LAB = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
_MAX_UPLOAD = 6 * 1024 * 1024  # 6 MB


@api.post("/upload/selfie")
async def upload_selfie(session_id: str = Form(...), file: UploadFile = File(...)):
    if file.content_type not in _ALLOWED_IMG:
        raise HTTPException(400, "Selfie must be JPEG, PNG, or WEBP.")
    data = await file.read()
    if len(data) > _MAX_UPLOAD:
        raise HTTPException(400, "Image is too large (max 6MB).")
    upload_id = f"selfie_{uuid.uuid4().hex[:12]}"
    b64 = base64.b64encode(data).decode()
    await db.uploads.insert_one({
        "upload_id": upload_id,
        "session_id": session_id,
        "kind": "selfie",
        "mime": file.content_type,
        "b64": b64,
        "size": len(data),
        "created_at": _now(),
    })
    return {"upload_id": upload_id, "size": len(data), "mime": file.content_type}


@api.post("/upload/lab-report")
async def upload_lab(session_id: str = Form(...), file: UploadFile = File(...)):
    if file.content_type not in _ALLOWED_LAB:
        raise HTTPException(400, "Lab report must be JPEG, PNG, WEBP, or PDF.")
    data = await file.read()
    if len(data) > _MAX_UPLOAD:
        raise HTTPException(400, "Report is too large (max 6MB).")
    upload_id = f"lab_{uuid.uuid4().hex[:12]}"
    b64 = base64.b64encode(data).decode()
    await db.uploads.insert_one({
        "upload_id": upload_id,
        "session_id": session_id,
        "kind": "lab",
        "mime": file.content_type,
        "b64": b64,
        "size": len(data),
        "created_at": _now(),
    })
    return {"upload_id": upload_id, "size": len(data), "mime": file.content_type}


# ---- Intake submit + safety check -----------------------------------------
@api.post("/intake/submit")
async def submit_intake(payload: IntakeSubmit):
    # 1) SAFETY CHECK — runs FIRST, before anything else touches the input
    free_texts = [payload.chat_text or ""] + [
        a.free_text for a in payload.answers if a.free_text
    ]
    reason = check_medical_urgency(free_texts)
    if reason:
        # Persist that this session was blocked for this category (audit trail).
        await db.safety_blocks.insert_one({
            "session_id": payload.session_id,
            "category": payload.category,
            "reason": reason,
            "at": _now(),
        })
        return {
            "blocked": True,
            "reason": reason,
            "message": BLOCK_MESSAGE,
        }

    # 2) Fetch uploaded content (if any)
    selfie_b64 = None
    selfie_mime = None
    lab_b64 = None
    lab_mime = None
    if payload.selfie_upload_id:
        up = await db.uploads.find_one({"upload_id": payload.selfie_upload_id})
        if up:
            selfie_b64 = up["b64"]
            selfie_mime = up["mime"]
    if payload.lab_upload_id:
        up = await db.uploads.find_one({"upload_id": payload.lab_upload_id})
        if up:
            lab_b64 = up["b64"]
            lab_mime = up["mime"]

    intake_doc = {
        "session_id": payload.session_id,
        "category": payload.category,
        "name": (payload.name or "").strip() or None,
        "chat_text": payload.chat_text,
        "answers": [a.model_dump() for a in payload.answers],
        "selfie_upload_id": payload.selfie_upload_id,
        "lab_upload_id": payload.lab_upload_id,
        "selfie_b64": selfie_b64,
        "selfie_mime": selfie_mime,
        "lab_b64": lab_b64,
        "lab_mime": lab_mime,
        "submitted_at": _now(),
    }
    # Upsert per (session, category)
    await db.intakes.replace_one(
        {"session_id": payload.session_id, "category": payload.category},
        intake_doc,
        upsert=True,
    )

    return {"blocked": False, "message": "Intake received."}


# ---- Free hook (partial dosha read) ---------------------------------------
@api.post("/free-hook")
async def free_hook(payload: ReportRequest):
    intake = await _get_intake(payload.session_id, payload.category)
    if not intake:
        raise HTTPException(404, "No intake found. Please complete the intake first.")

    # SAFETY re-check (belt-and-suspenders)
    reason = check_medical_urgency(_collect_free_text(intake))
    if reason:
        return {"blocked": True, "message": BLOCK_MESSAGE, "reason": reason}

    dosha_result = _dosha_breakdown_from_intake(payload.category, intake)
    dosha = dosha_result["dominant"]
    frame = DOSHA_HINTS[payload.category][dosha]["frame"]
    teaser = await _generate_teaser_line(payload.category, dosha, intake)

    return {
        "blocked": False,
        "category": payload.category,
        "user_name": intake.get("name"),
        "dosha": dosha,
        "dosha_label": dosha.capitalize(),
        "dosha_breakdown": dosha_result["breakdown"],
        "hook": f"{frame} {teaser}".strip(),
        "frame": frame,
        "teaser": teaser,
    }


# ---- Payments (Razorpay Payment Links) ------------------------------------
@api.post("/payments/create-link")
async def create_payment_link(payload: PaymentCreate):
    # Do NOT allow payment if the session was medically blocked for this category
    block = await db.safety_blocks.find_one({
        "session_id": payload.session_id,
        "category": payload.category,
    })
    if block:
        raise HTTPException(400, "This session cannot proceed to payment for safety reasons.")

    amount = PRICE_SINGLE_PAISE if payload.plan == "single" else PRICE_COMBO_PAISE
    description = PRODUCT_LABEL[payload.plan]

    reference_id = f"pdx_{uuid.uuid4().hex[:16]}"
    client_rzp = rzp()

    callback_url = f"{APP_PUBLIC_URL}/?session_id={payload.session_id}&paid_ref={reference_id}"

    link_payload = {
        "amount": amount,
        "currency": "INR",
        "accept_partial": False,
        "reference_id": reference_id,
        "description": description,
        "customer": {"name": "PrakritiDx User"},
        "notify": {"sms": False, "email": False},
        "reminder_enable": False,
        "notes": {
            "session_id": payload.session_id,
            "plan": payload.plan,
            "category": payload.category,
        },
        "callback_url": callback_url,
        "callback_method": "get",
    }

    try:
        link = client_rzp.payment_link.create(link_payload)
    except Exception as e:
        logger.exception("Razorpay create_link failed")
        raise HTTPException(500, f"Could not create payment link: {e}")

    doc = {
        "reference_id": reference_id,
        "session_id": payload.session_id,
        "plan": payload.plan,
        "category": payload.category,
        "amount": amount,
        "razorpay_link_id": link.get("id"),
        "short_url": link.get("short_url"),
        "status": "pending",
        "created_at": _now(),
    }
    await db.payments.insert_one(doc)

    return {
        "reference_id": reference_id,
        "payment_link_id": link.get("id"),
        "short_url": link.get("short_url"),
        "amount": amount,
        "amount_rupees": amount // 100,
        "plan": payload.plan,
    }


@api.get("/payments/status/{session_id}")
async def payments_status(session_id: str):
    """Return unlock state for a session. Combo unlocks both, single unlocks only its own category."""
    combo_paid = False
    unlocked = {"skin": False, "hair": False}
    cursor = db.payments.find({"session_id": session_id, "status": "paid"})
    async for p in cursor:
        if p.get("plan") == "combo":
            combo_paid = True
            unlocked["skin"] = True
            unlocked["hair"] = True
        elif p.get("plan") == "single":
            unlocked[p.get("category", "skin")] = True
    return {"session_id": session_id, "combo_paid": combo_paid, "unlocked": unlocked}


@api.post("/payments/verify")
async def payments_verify(session_id: str = Body(..., embed=True), reference_id: Optional[str] = Body(None, embed=True)):
    """
    Polling endpoint. If a matching payment is not yet 'paid' locally, we query Razorpay
    for the latest link status and update our DB.
    """
    query = {"session_id": session_id}
    if reference_id:
        query["reference_id"] = reference_id
    payment = await db.payments.find_one(query, sort=[("created_at", -1)])
    if not payment:
        return {"status": "no_payment"}

    if payment["status"] != "paid":
        # Ask Razorpay for the current state
        try:
            link = rzp().payment_link.fetch(payment["razorpay_link_id"])
            status = link.get("status")  # created, partially_paid, paid, expired, cancelled
            if status == "paid":
                await db.payments.update_one(
                    {"_id": payment["_id"]},
                    {"$set": {"status": "paid", "paid_at": _now(), "raw_status": status}},
                )
                payment["status"] = "paid"
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Razorpay fetch failed")
            return {"status": payment["status"], "error": str(e)}

    return {
        "status": payment["status"],
        "plan": payment["plan"],
        "category": payment["category"],
        "reference_id": payment["reference_id"],
    }


@api.post("/payments/webhook")
async def payments_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Verify signature if webhook secret configured
    if RAZORPAY_WEBHOOK_SECRET:
        expected = hmac.new(
            RAZORPAY_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(400, "Invalid webhook signature.")

    try:
        event = json.loads(body.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "Invalid webhook body.")

    event_type = event.get("event")
    entity = (event.get("payload") or {}).get("payment_link", {}).get("entity") or \
             (event.get("payload") or {}).get("payment", {}).get("entity") or {}
    link_id = entity.get("id") or entity.get("payment_link_id")
    reference_id = entity.get("reference_id")

    if event_type in ("payment_link.paid", "payment.captured") and (link_id or reference_id):
        q = {}
        if link_id:
            q["razorpay_link_id"] = link_id
        elif reference_id:
            q["reference_id"] = reference_id
        await db.payments.update_one(q, {"$set": {"status": "paid", "paid_at": _now(), "raw_event": event_type}})

    return {"ok": True}


# ---- Full report (only if paid) -------------------------------------------
@api.post("/report/full")
async def full_report(payload: ReportRequest):
    # 0) unlock check
    status_resp = await payments_status(payload.session_id)
    if not status_resp["unlocked"].get(payload.category):
        raise HTTPException(402, "Payment required. This report is locked until payment is confirmed.")

    # 1) intake must exist
    intake = await _get_intake(payload.session_id, payload.category)
    if not intake:
        raise HTTPException(404, "No intake found for this category — please complete it first.")

    # 2) safety re-check
    reason = check_medical_urgency(_collect_free_text(intake))
    if reason:
        return {"blocked": True, "message": BLOCK_MESSAGE, "reason": reason}

    # 3) cached? (skipped entirely when the caller explicitly asks for a
    # fresh take via `regenerate` — e.g. after redoing intake with new
    # answers, or tapping "Regenerate" on an already-viewed report)
    if not payload.regenerate:
        cached = await db.reports.find_one({
            "session_id": payload.session_id,
            "category": payload.category,
        })
        if cached:
            cached.pop("_id", None)
            return cached

    # 4) generate
    dosha_result = _dosha_breakdown_from_intake(payload.category, intake)
    dosha = dosha_result["dominant"]
    try:
        data = await _generate_full_report(payload.category, dosha, intake)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Full report generation failed")
        raise HTTPException(500, f"Report generation failed: {e}")

    result = {
        "session_id": payload.session_id,
        "category": payload.category,
        "user_name": intake.get("name"),
        "dosha": dosha,
        "dosha_label": dosha.capitalize(),
        "dosha_breakdown": dosha_result["breakdown"],
        "generated_at": _now(),
        **data,
    }
    # replace_one(upsert=True) instead of insert_one — a regenerate call
    # must cleanly overwrite the previous cached report for this
    # session+category, not create a second document alongside it (which
    # would make the earlier cache lookup's result unpredictable).
    await db.reports.replace_one(
        {"session_id": payload.session_id, "category": payload.category},
        dict(result),
        upsert=True,
    )
    return result


@api.post("/report/email")
async def email_report(payload: EmailReportRequest):
    """Sends a 'save your report' email with a magic restore link. Reuses
    the same unlock + existence checks as viewing the report, so this can't
    be used to email arbitrary addresses about a session that never paid or
    never generated a report.

    Rate-limited per report (not just per request): the recipient's email
    is never verified as belonging to whoever clicks Send, so without a
    limit here this could be used to repeatedly email an unrelated
    stranger. A short cooldown plus a small lifetime cap covers the
    legitimate "save it" / "resend, I missed it" use case while blocking
    sustained abuse.
    """
    if not _EMAIL_RE.match(payload.email.strip()):
        raise HTTPException(400, "Please enter a valid email address.")

    status_resp = await payments_status(payload.session_id)
    if not status_resp["unlocked"].get(payload.category):
        raise HTTPException(402, "This report isn't unlocked yet.")

    report = await db.reports.find_one({
        "session_id": payload.session_id,
        "category": payload.category,
    })
    if not report:
        raise HTTPException(404, "No report found yet — generate it first.")
    report.pop("_id", None)

    now = datetime.now(timezone.utc)
    last_sent_str = report.get("last_emailed_at")
    send_count = report.get("email_send_count", 0)

    if last_sent_str:
        try:
            last_sent = datetime.fromisoformat(last_sent_str)
            elapsed = (now - last_sent).total_seconds()
            if elapsed < 60:
                raise HTTPException(429, "Please wait a moment before sending again.")
        except HTTPException:
            raise
        except Exception:
            pass  # malformed/legacy timestamp — don't block on a parse issue

    if send_count >= 5:
        raise HTTPException(
            429,
            "This report has already been emailed several times. Please check "
            "an earlier email, or contact support if you still need help.",
        )

    restore_url = f"{APP_PUBLIC_URL}/?restore={payload.session_id}&cat={payload.category}"

    sent = await asyncio.to_thread(_send_report_email, payload.email.strip(), report, restore_url)
    if not sent:
        raise HTTPException(503, "Could not send email right now — please try again shortly.")

    await db.reports.update_one(
        {"session_id": payload.session_id, "category": payload.category},
        {"$set": {"last_emailed_at": now.isoformat()}, "$inc": {"email_send_count": 1}},
    )

    return {"sent": True}


# ---- Utilities -------------------------------------------------------------
@api.get("/session/{session_id}/state")
async def session_state(session_id: str):
    intakes = {}
    for cat in ("skin", "hair"):
        i = await _get_intake(session_id, cat)
        if i:
            i.pop("selfie_b64", None)
            i.pop("lab_b64", None)
            intakes[cat] = {
                "submitted_at": i.get("submitted_at"),
                "has_selfie": bool(i.get("selfie_upload_id")),
                "has_lab": bool(i.get("lab_upload_id")),
            }
    payments = await payments_status(session_id)
    blocked = {}
    for cat in ("skin", "hair"):
        b = await db.safety_blocks.find_one({"session_id": session_id, "category": cat})
        if b:
            blocked[cat] = b.get("reason")
    return {"session_id": session_id, "intakes": intakes, "payments": payments, "blocked": blocked}


# -----------------------------------------------------------------------------
# App wiring
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",")] if CORS_ORIGINS != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api)


@app.get("/")
async def root():
    return {"app": "PrakritiDx", "version": "2.0.0", "status": "running"}
