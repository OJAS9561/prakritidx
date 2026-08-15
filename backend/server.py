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
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

# Model name — Gemini's free tier (via Google AI Studio) currently covers Flash-class
# models. Bump this here if Google moves the free tier to a newer Flash model.
GEMINI_MODEL = "gemini-3.5-flash"

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


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
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


def _tally_dosha_from_intake(category: str, intake: Dict[str, Any]) -> str:
    """Naive scoring: count how many selected multi-select values match each dosha's signal set."""
    hints = DOSHA_HINTS[category]
    picked_values: List[str] = []
    for a in intake.get("answers", []):
        picked_values.extend(a.get("values") or [])
    scores = {"vata": 0, "pitta": 0, "kapha": 0}
    for dosha, meta in hints.items():
        for v in meta["signals"]:
            if v in picked_values:
                scores[dosha] += 1
    # ties broken by first-declared order (vata > pitta > kapha)
    ordered = sorted(scores.items(), key=lambda x: (-x[1], ["vata", "pitta", "kapha"].index(x[0])))
    return ordered[0][0]


async def _call_gemini_with_retry(**kwargs):
    """
    Call Gemini with retry + exponential backoff on transient rate-limit errors
    (free tier can return 429 / RESOURCE_EXHAUSTED under bursts). Non-rate-limit
    errors are raised immediately — no point retrying a genuinely bad request.
    Worst case: ~3 retries over ~13s before giving up, so a paying user isn't
    left staring at an instant failure from a momentary limit.
    """
    delays = [2, 4, 8]  # seconds, exponential backoff
    last_exc = None
    for attempt, delay in enumerate([0] + delays):
        if delay:
            await asyncio.sleep(delay)
        try:
            return await gemini_client.aio.models.generate_content(**kwargs)
        except Exception as e:
            last_exc = e
            msg = str(e).lower()
            is_rate_limit = "429" in msg or "resource_exhausted" in msg or "rate limit" in msg or "quota" in msg
            if not is_rate_limit:
                raise
            logger.warning("Gemini rate-limited (attempt %d/%d): %s", attempt + 1, len(delays) + 1, e)
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
    {{"time": "Morning", "step": "Concise step", "why": "One-line Ayurvedic + modern reason"}},
    {{"time": "Evening", "step": "...", "why": "..."}},
    {{"time": "Weekly", "step": "...", "why": "..."}}
  ],
  "key_ingredients": [
    {{"name": "Ingredient", "role": "What it does for this dosha"}}
  ],
  "diet": {{
    "favor": ["food/practice", "..."],
    "reduce": ["food/practice", "..."]
  }},
  "daily_practice": [
    "Actionable daily/weekly habit specific to their constitution and presentation"
  ],
  "avoid": ["Specific ingredient/practice to avoid based on their intake", "..."],
  "herbs": [
    {{"name": "Herb", "usage": "How to use it — internal or topical"}}
  ],
  "when_to_see_doctor": ["Specific escalation signal (e.g. 'if breakouts turn painful and warm')"]
}}

Constraints:
- routine: 5-7 items covering Morning, Evening, and Weekly.
- key_ingredients: 5-7 items with real Ayurvedic + modern names.
- diet.favor: 5-8 items; diet.reduce: 4-6 items.
- daily_practice: 4-6 items.
- avoid: 4-6 items.
- herbs: 3-5 items.
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

    try:
        response = await _call_gemini_with_retry(
            model=GEMINI_MODEL,
            contents=content_parts,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=2000,
                response_mime_type="application/json",
            ),
        )
    except Exception as e:
        logger.exception("Gemini report generation failed after retries")
        raise HTTPException(
            503,
            "Our AI is briefly overloaded generating your report. Your payment is safe — "
            "please tap to try again in a moment.",
        ) from e
    text = (response.text or "").strip()

    # Strip code fences if any
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            data = json.loads(text[start:end + 1])
        else:
            raise HTTPException(500, "AI report could not be parsed.")
    return data


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

    dosha = _tally_dosha_from_intake(payload.category, intake)
    frame = DOSHA_HINTS[payload.category][dosha]["frame"]
    teaser = await _generate_teaser_line(payload.category, dosha, intake)

    return {
        "blocked": False,
        "category": payload.category,
        "dosha": dosha,
        "dosha_label": dosha.capitalize(),
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

    # 3) cached?
    cached = await db.reports.find_one({
        "session_id": payload.session_id,
        "category": payload.category,
    })
    if cached:
        cached.pop("_id", None)
        return cached

    # 4) generate
    dosha = _tally_dosha_from_intake(payload.category, intake)
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
        "dosha": dosha,
        "dosha_label": dosha.capitalize(),
        "generated_at": _now(),
        **data,
    }
    await db.reports.insert_one(dict(result))
    return result


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
