"""
PrakritiDx Backend — AI-powered Ayurvedic Skin & Hair guidance.
FastAPI + MongoDB + Emergent LLM (Claude Sonnet 4.5).
"""
import os
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Literal, List, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load env FIRST
load_dotenv()

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("prakritidx")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="PrakritiDx API", version="0.1.0")
api = APIRouter(prefix="/api")

# -----------------------------------------------------------------------------
# Curated Prakriti quiz (12 questions, works for both skin & hair with context)
# -----------------------------------------------------------------------------
Category = Literal["skin", "hair"]
Dosha = Literal["vata", "pitta", "kapha"]

QUIZ_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "q1",
        "prompt": "How would you describe your natural {surface}?",
        "options": [
            {"value": "vata", "label_skin": "Dry, thin, sometimes flaky", "label_hair": "Dry, frizzy, prone to breakage"},
            {"value": "pitta", "label_skin": "Sensitive, warm, occasional redness", "label_hair": "Fine, silky, prone to early greying"},
            {"value": "kapha", "label_skin": "Oily, thick, smooth", "label_hair": "Thick, dense, oily at roots"},
        ],
    },
    {
        "id": "q2",
        "prompt": "In cold weather, your {surface} usually…",
        "options": [
            {"value": "vata", "label_skin": "Feels tight, rough, or cracks", "label_hair": "Becomes brittle, static, or tangled"},
            {"value": "pitta", "label_skin": "Feels balanced but flushes easily", "label_hair": "Stays mostly the same"},
            {"value": "kapha", "label_skin": "Stays supple, minimal change", "label_hair": "Feels heavier but healthy"},
        ],
    },
    {
        "id": "q3",
        "prompt": "In hot & humid weather, your {surface} tends to…",
        "options": [
            {"value": "vata", "label_skin": "Feels okay, sometimes dehydrated", "label_hair": "Frizzes but doesn't get oily"},
            {"value": "pitta", "label_skin": "Breaks out, gets red or irritated", "label_hair": "Sweats at scalp, itchy"},
            {"value": "kapha", "label_skin": "Gets very oily and congested", "label_hair": "Becomes greasy fast"},
        ],
    },
    {
        "id": "q4",
        "prompt": "How often do you experience blemishes / scalp issues?",
        "options": [
            {"value": "vata", "label_skin": "Rarely, but dry patches instead", "label_hair": "Rarely oily, more flaky scalp"},
            {"value": "pitta", "label_skin": "Often — inflamed, red pimples", "label_hair": "Itchy scalp, sensitive"},
            {"value": "kapha", "label_skin": "Cystic, whiteheads, congestion", "label_hair": "Dandruff, heavy oil buildup"},
        ],
    },
    {
        "id": "q5",
        "prompt": "Your {surface} responds to stress by…",
        "options": [
            {"value": "vata", "label_skin": "Getting drier, more sensitive", "label_hair": "Shedding, becoming dull"},
            {"value": "pitta", "label_skin": "Flaring red, rashes, breakouts", "label_hair": "Greying, thinning at temples"},
            {"value": "kapha", "label_skin": "Getting puffy, oilier", "label_hair": "Getting greasier, heavier"},
        ],
    },
    {
        "id": "q6",
        "prompt": "Your body frame is generally…",
        "options": [
            {"value": "vata", "label_skin": "Lean, light, fast metabolism", "label_hair": "Lean, light, fast metabolism"},
            {"value": "pitta", "label_skin": "Medium, athletic, warm-bodied", "label_hair": "Medium, athletic, warm-bodied"},
            {"value": "kapha", "label_skin": "Solid, curvy, gains weight easily", "label_hair": "Solid, curvy, gains weight easily"},
        ],
    },
    {
        "id": "q7",
        "prompt": "Your energy through the day is…",
        "options": [
            {"value": "vata", "label_skin": "Burst-and-crash, variable", "label_hair": "Burst-and-crash, variable"},
            {"value": "pitta", "label_skin": "Sharp, focused, intense", "label_hair": "Sharp, focused, intense"},
            {"value": "kapha", "label_skin": "Steady, calm, slow to start", "label_hair": "Steady, calm, slow to start"},
        ],
    },
    {
        "id": "q8",
        "prompt": "Your appetite / digestion is…",
        "options": [
            {"value": "vata", "label_skin": "Irregular, sometimes forgets meals", "label_hair": "Irregular, sometimes forgets meals"},
            {"value": "pitta", "label_skin": "Strong, gets 'hangry' quickly", "label_hair": "Strong, gets 'hangry' quickly"},
            {"value": "kapha", "label_skin": "Slow but steady, rarely hungry", "label_hair": "Slow but steady, rarely hungry"},
        ],
    },
    {
        "id": "q9",
        "prompt": "You sleep…",
        "options": [
            {"value": "vata", "label_skin": "Lightly, easily disturbed, vivid dreams", "label_hair": "Lightly, easily disturbed, vivid dreams"},
            {"value": "pitta", "label_skin": "Moderately, wake feeling rested", "label_hair": "Moderately, wake feeling rested"},
            {"value": "kapha", "label_skin": "Deeply, love long sleep, hard to wake", "label_hair": "Deeply, love long sleep, hard to wake"},
        ],
    },
    {
        "id": "q10",
        "prompt": "Under the sun, your {surface} usually…",
        "options": [
            {"value": "vata", "label_skin": "Tans lightly, feels dehydrated", "label_hair": "Gets brittle and lightens"},
            {"value": "pitta", "label_skin": "Burns easily, freckles", "label_hair": "Fades color, scalp burns"},
            {"value": "kapha", "label_skin": "Tans evenly, tolerates well", "label_hair": "Handles sun well, stays healthy"},
        ],
    },
    {
        "id": "q11",
        "prompt": "Your natural {surface} tone/texture leans…",
        "options": [
            {"value": "vata", "label_skin": "Cool undertone, thin & delicate", "label_hair": "Wispy, curly or kinky texture"},
            {"value": "pitta", "label_skin": "Warm undertone, freckled or ruddy", "label_hair": "Fine, wavy, medium density"},
            {"value": "kapha", "label_skin": "Even, luminous, thicker feel", "label_hair": "Wavy to straight, thick strands"},
        ],
    },
    {
        "id": "q12",
        "prompt": "Which resonates most for your ideal outcome?",
        "options": [
            {"value": "vata", "label_skin": "Deep nourishment & hydration", "label_hair": "Strength, moisture & shine"},
            {"value": "pitta", "label_skin": "Calm, cool, clear complexion", "label_hair": "Soothed scalp, less shedding"},
            {"value": "kapha", "label_skin": "Detox, clarity, less oiliness", "label_hair": "Volume, freshness, less buildup"},
        ],
    },
]


# -----------------------------------------------------------------------------
# Curated Ayurvedic ingredient / routine library
# -----------------------------------------------------------------------------
INGREDIENT_LIBRARY: Dict[str, Dict[str, List[Dict[str, str]]]] = {
    "skin": {
        "vata": [
            {"name": "Almond Oil", "sanskrit": "Vatada Taila", "benefit": "Deeply nourishes dry, thin skin"},
            {"name": "Ashwagandha", "sanskrit": "Ashwagandha", "benefit": "Calms stress-induced sensitivity"},
            {"name": "Sesame Oil", "sanskrit": "Tila Taila", "benefit": "Grounding warm oil for dry skin"},
            {"name": "Shatavari", "sanskrit": "Shatavari", "benefit": "Restores moisture and elasticity"},
            {"name": "Rose", "sanskrit": "Gulab", "benefit": "Hydrating and softening mist"},
        ],
        "pitta": [
            {"name": "Sandalwood", "sanskrit": "Chandana", "benefit": "Cools redness and inflammation"},
            {"name": "Aloe Vera", "sanskrit": "Kumari", "benefit": "Soothes heat and irritation"},
            {"name": "Manjistha", "sanskrit": "Manjistha", "benefit": "Purifies blood, evens tone"},
            {"name": "Neem", "sanskrit": "Nimba", "benefit": "Antibacterial for acne-prone skin"},
            {"name": "Rose Water", "sanskrit": "Gulab Jal", "benefit": "pH-balancing and calming"},
        ],
        "kapha": [
            {"name": "Turmeric", "sanskrit": "Haridra", "benefit": "Detoxifies and brightens"},
            {"name": "Tulsi", "sanskrit": "Tulsi", "benefit": "Clears congestion and buildup"},
            {"name": "Clay (Multani Mitti)", "sanskrit": "Multani Mitti", "benefit": "Absorbs excess oil"},
            {"name": "Ginger", "sanskrit": "Adraka", "benefit": "Boosts circulation"},
            {"name": "Honey (raw)", "sanskrit": "Madhu", "benefit": "Antibacterial exfoliant"},
        ],
    },
    "hair": {
        "vata": [
            {"name": "Bhringraj Oil", "sanskrit": "Bhringraj", "benefit": "Nourishes dry, brittle strands"},
            {"name": "Amla", "sanskrit": "Amalaki", "benefit": "Strengthens weak roots"},
            {"name": "Coconut Oil", "sanskrit": "Narikela Taila", "benefit": "Locks in moisture"},
            {"name": "Brahmi", "sanskrit": "Brahmi", "benefit": "Calms scalp, thickens hair"},
            {"name": "Fenugreek", "sanskrit": "Methi", "benefit": "Restores shine and softness"},
        ],
        "pitta": [
            {"name": "Amla", "sanskrit": "Amalaki", "benefit": "Prevents early greying"},
            {"name": "Bhringraj", "sanskrit": "Bhringraj", "benefit": "Cools scalp, prevents shedding"},
            {"name": "Coconut Oil", "sanskrit": "Narikela Taila", "benefit": "Cooling scalp treatment"},
            {"name": "Hibiscus", "sanskrit": "Japa", "benefit": "Soothes irritation, promotes growth"},
            {"name": "Neem", "sanskrit": "Nimba", "benefit": "Anti-inflammatory scalp care"},
        ],
        "kapha": [
            {"name": "Reetha", "sanskrit": "Aritha", "benefit": "Deep cleanses excess oil"},
            {"name": "Shikakai", "sanskrit": "Shikakai", "benefit": "Gentle clarifying wash"},
            {"name": "Neem", "sanskrit": "Nimba", "benefit": "Fights dandruff and buildup"},
            {"name": "Tulsi", "sanskrit": "Tulsi", "benefit": "Refreshes heavy, greasy scalp"},
            {"name": "Rosemary", "sanskrit": "Rosemary", "benefit": "Stimulates roots, adds volume"},
        ],
    },
}


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class Answer(BaseModel):
    question_id: str
    value: Dosha


class QuizSubmission(BaseModel):
    session_id: str = Field(..., min_length=1)
    category: Category
    answers: List[Answer]


class DoshaScores(BaseModel):
    vata: int
    pitta: int
    kapha: int


class QuizResult(BaseModel):
    session_id: str
    category: Category
    primary_dosha: Dosha
    secondary_dosha: Optional[Dosha] = None
    scores: DoshaScores
    dosha_label: str  # e.g. "Vata-Pitta"
    submitted_at: str


class RecommendationRequest(BaseModel):
    session_id: str
    category: Category
    primary_dosha: Dosha
    secondary_dosha: Optional[Dosha] = None


class Recommendations(BaseModel):
    session_id: str
    category: Category
    dosha_label: str
    summary: str
    routine: List[Dict[str, str]]  # [{time, step, why}]
    key_ingredients: List[Dict[str, str]]
    avoid: List[str]
    do: List[str]
    dont: List[str]
    herbs: List[Dict[str, str]]
    generated_at: str


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
DOSHA_META = {
    "vata": {"element": "Air & Space", "quality": "Dry, light, cool, mobile", "color": "#8B7BAA"},
    "pitta": {"element": "Fire & Water", "quality": "Hot, sharp, oily, intense", "color": "#B8632F"},
    "kapha": {"element": "Earth & Water", "quality": "Heavy, cool, oily, stable", "color": "#5C7A5A"},
}


def compute_dosha(answers: List[Answer]) -> Dict[str, Any]:
    scores = {"vata": 0, "pitta": 0, "kapha": 0}
    for a in answers:
        scores[a.value] = scores.get(a.value, 0) + 1

    sorted_doshas = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    primary = sorted_doshas[0][0]
    secondary = None
    # If second is close (within 2 points), treat as dual dosha
    if sorted_doshas[1][1] >= sorted_doshas[0][1] - 2 and sorted_doshas[1][1] > 0:
        secondary = sorted_doshas[1][0]

    if secondary:
        label = f"{primary.capitalize()}-{secondary.capitalize()}"
    else:
        label = primary.capitalize()

    return {
        "scores": scores,
        "primary": primary,
        "secondary": secondary,
        "label": label,
    }


async def generate_ai_recommendations(
    category: str, dosha_label: str, primary: str, secondary: Optional[str]
) -> Dict[str, Any]:
    """Call Claude Sonnet 4.5 via Emergent LLM to generate personalized recommendations."""
    session_id = f"rec-{uuid.uuid4().hex[:12]}"

    system_prompt = (
        "You are an expert Ayurvedic consultant blending classical Ayurveda with modern dermatology "
        "and trichology. You give clean, structured, evidence-friendly guidance. Never use generic "
        "'wellness' fluff. Never recommend prescription medications. Speak with warmth and precision."
    )

    surface = "skin" if category == "skin" else "scalp & hair"
    prompt = f"""Generate a personalized Ayurvedic {surface} regimen for a {dosha_label} constitution
(primary dosha: {primary}{', secondary: ' + secondary if secondary else ''}).

Return ONLY valid JSON matching exactly this shape (no markdown, no code fences):
{{
  "summary": "2-3 sentence overview of what this dosha means for their {surface} and the guiding principle for care",
  "routine": [
    {{"time": "Morning", "step": "Concise step", "why": "One-line Ayurvedic + modern reason"}},
    {{"time": "Morning", "step": "...", "why": "..."}},
    {{"time": "Evening", "step": "...", "why": "..."}},
    {{"time": "Weekly", "step": "...", "why": "..."}}
  ],
  "key_ingredients": [
    {{"name": "Ingredient name", "role": "What it does for this dosha"}}
  ],
  "avoid": ["Specific ingredient/practice to avoid", "..."],
  "do": ["Actionable daily habit", "..."],
  "dont": ["Habit to stop", "..."],
  "herbs": [
    {{"name": "Herb", "usage": "How to use it — internal or topical"}}
  ]
}}

Constraints:
- routine: exactly 4-6 items covering Morning, Evening, and Weekly.
- key_ingredients: 4-6 items
- avoid: 3-5 items
- do: 4-6 items
- dont: 3-5 items
- herbs: 3-5 items
- Focus specifically on {surface}, not general wellness.
- Be concrete: name real ingredients (e.g. "sandalwood powder", "bhringraj oil") not vague categories.
"""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    response = await chat.send_message(UserMessage(text=prompt))
    text = str(response).strip()

    # Strip potential code fences
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # find first { and last }
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            data = json.loads(text[start:end + 1])
        else:
            raise HTTPException(500, "AI response could not be parsed")
    return data


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@api.get("/health")
async def health():
    return {"status": "ok", "service": "prakritidx", "time": datetime.now(timezone.utc).isoformat()}


@api.get("/quiz/{category}")
async def get_quiz(category: Category):
    """Return the quiz questions formatted for skin or hair."""
    surface = "skin" if category == "skin" else "hair"
    formatted = []
    for q in QUIZ_QUESTIONS:
        formatted.append({
            "id": q["id"],
            "prompt": q["prompt"].format(surface=surface),
            "options": [
                {
                    "value": opt["value"],
                    "label": opt.get(f"label_{category}", opt.get("label_skin", "")),
                }
                for opt in q["options"]
            ],
        })
    return {"category": category, "questions": formatted, "total": len(formatted)}


@api.post("/quiz/submit", response_model=QuizResult)
async def submit_quiz(payload: QuizSubmission):
    if len(payload.answers) < 6:
        raise HTTPException(400, "Answer more questions to get a reliable result.")

    result = compute_dosha(payload.answers)

    doc = {
        "id": str(uuid.uuid4()),
        "session_id": payload.session_id,
        "category": payload.category,
        "answers": [a.model_dump() for a in payload.answers],
        "scores": result["scores"],
        "primary_dosha": result["primary"],
        "secondary_dosha": result["secondary"],
        "dosha_label": result["label"],
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quiz_results.insert_one(doc)

    return QuizResult(
        session_id=payload.session_id,
        category=payload.category,
        primary_dosha=result["primary"],
        secondary_dosha=result["secondary"],
        scores=DoshaScores(**result["scores"]),
        dosha_label=result["label"],
        submitted_at=doc["submitted_at"],
    )


@api.post("/recommendations", response_model=Recommendations)
async def get_recommendations(payload: RecommendationRequest):
    # Check cache first
    cache_key = {
        "session_id": payload.session_id,
        "category": payload.category,
        "primary_dosha": payload.primary_dosha,
        "secondary_dosha": payload.secondary_dosha,
    }
    cached = await db.recommendations.find_one(cache_key)
    if cached:
        cached.pop("_id", None)
        return cached

    dosha_label = payload.primary_dosha.capitalize()
    if payload.secondary_dosha:
        dosha_label = f"{payload.primary_dosha.capitalize()}-{payload.secondary_dosha.capitalize()}"

    try:
        ai_data = await generate_ai_recommendations(
            payload.category, dosha_label, payload.primary_dosha, payload.secondary_dosha
        )
    except Exception as e:
        logger.exception("AI generation failed")
        raise HTTPException(500, f"Could not generate recommendations: {str(e)}")

    rec = {
        **cache_key,
        "dosha_label": dosha_label,
        "summary": ai_data.get("summary", ""),
        "routine": ai_data.get("routine", []),
        "key_ingredients": ai_data.get("key_ingredients", []),
        "avoid": ai_data.get("avoid", []),
        "do": ai_data.get("do", []),
        "dont": ai_data.get("dont", []),
        "herbs": ai_data.get("herbs", []),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.recommendations.insert_one(dict(rec))
    rec.pop("_id", None)
    return rec


@api.get("/ingredients/{category}/{dosha}")
async def get_ingredients(category: Category, dosha: Dosha):
    return {
        "category": category,
        "dosha": dosha,
        "items": INGREDIENT_LIBRARY[category][dosha],
    }


@api.get("/dosha/meta")
async def dosha_meta():
    return DOSHA_META


@api.get("/results/{session_id}")
async def get_session_results(session_id: str):
    cursor = db.quiz_results.find({"session_id": session_id}).sort("submitted_at", -1)
    out = []
    async for doc in cursor:
        doc.pop("_id", None)
        out.append(doc)
    return {"session_id": session_id, "results": out}


# CORS
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
    return {"app": "PrakritiDx", "status": "running"}
