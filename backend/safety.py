"""
Medical-urgency safety check for PrakritiDx.

Hard-blocks the dosha analysis if any red-flag phrase is detected in user-provided
free-text (chat description or optional medical history field). There is NO way to
bypass this — no acknowledgement, no confirmation, no override. This is the
non-negotiable safety rail before any Ayurvedic guidance is offered.
"""
import re
from typing import List, Optional, Tuple


BLOCK_MESSAGE = (
    "This sounds like something that needs a doctor's attention rather than a "
    "lifestyle routine. Please consult a physician or visit a clinic — PrakritiDx "
    "isn't able to safely guide you on this. If it's urgent, please seek immediate "
    "medical care."
)


# Simple phrase / regex-based rules. Kept as a plain list so this is trivially expandable later.
# Each rule is (pattern, category) where pattern is compiled case-insensitive.
_RULES: List[Tuple[re.Pattern, str]] = [
    # bleeding & open wounds
    (re.compile(r"\bbleed(ing)?\b", re.I), "bleeding"),
    (re.compile(r"\bopen\s+wound(s)?\b", re.I), "open_wound"),
    (re.compile(r"\bpus\b.{0,40}\bfever\b|\bfever\b.{0,40}\bpus\b", re.I), "pus_with_fever"),
    # rapidly spreading
    (re.compile(r"\brapidly\s+spread(ing)?\s+rash\b", re.I), "rapidly_spreading_rash"),
    (re.compile(r"\bspreading\s+(fast|quickly|rapidly)\b", re.I), "rapid_spread"),
    # swelling
    (re.compile(r"\bsudden(ly)?\s+(severe|bad)\s+swell(ing)?\b", re.I), "sudden_severe_swelling"),
    (re.compile(r"\bfacial\s+swell(ing)?\b", re.I), "facial_swelling"),
    (re.compile(r"\bswollen\s+face\b|\bface\s+is\s+swollen\b", re.I), "facial_swelling"),
    # breathing
    (re.compile(r"\b(difficulty|trouble|hard(er)?\s+time)\s+breath(ing)?\b", re.I), "breathing_difficulty"),
    (re.compile(r"\bcan(?:'|\s)t\s+breathe\b|\bshortness\s+of\s+breath\b", re.I), "breathing_difficulty"),
    # fever + skin symptom (co-occurrence)
    # handled below via co-occurrence helper
    # moles
    (re.compile(r"\bmole\b.{0,80}(changing|change|growing|growing\s+bigger|different\s+shape|different\s+color|different\s+size|irregular)", re.I), "mole_changing"),
    (re.compile(r"\b(changing|growing|new)\b.{0,40}\bmole\b", re.I), "mole_changing"),
    # burns
    (re.compile(r"\bchemical\s+burn\b", re.I), "chemical_burn"),
    (re.compile(r"\bthermal\s+burn\b|\bburn(ed|t)?\s+(with|by|from)\s+(hot|boiling|fire)\b", re.I), "thermal_burn"),
    # child / infant mentions
    (re.compile(r"\bfor\s+my\s+(child|kid|infant|baby|newborn|toddler|son|daughter)\b", re.I), "child_symptom"),
    (re.compile(r"\bmy\s+(child|kid|infant|baby|newborn|toddler|son|daughter)\b.{0,120}(rash|skin|hair|itch|red|spot|breakout)", re.I), "child_symptom"),
    # diagnosed + serious conditions
    (re.compile(r"\bdiagnos(ed|is)\b.{0,60}(autoimmune|lupus|psoriatic|cancer|melanoma|carcinoma|leukemia|lymphoma)", re.I), "diagnosed_serious"),
    (re.compile(r"\bdiagnos(ed|is)\b.{0,60}(severe\s+allerg|anaphylax)", re.I), "diagnosed_severe_allergy"),
    (re.compile(r"\banaphylaxis\b|\banaphylactic\b", re.I), "anaphylaxis"),
]


# Terms that indicate "skin/hair symptom" — used only for fever-co-occurrence detection.
_SKIN_SYMPTOM_TERMS = re.compile(
    r"\b(rash|hives|blister|lesion|breakout|acne|eczema|dermatitis|redness|itch(y|ing)?|inflam(ed|mation)|scab|spot(s)?)\b",
    re.I,
)
_FEVER_TERMS = re.compile(r"\bfever(ish)?\b|\b\d{2,3}\s?(°\s?)?[fF]\b|\b\d{2,3}\s?(°\s?)?[cC]\b", re.I)


def check_medical_urgency(text_fields: Optional[List[str]]) -> Optional[str]:
    """
    Scan the combined free-text from the user for medical red flags.

    Args:
        text_fields: list of free-text strings (chat, medical history, etc.)
                     Any None values are ignored.

    Returns:
        Reason string (short slug) if blocked, or None if all clear.
    """
    if not text_fields:
        return None
    combined = " \n ".join(t for t in text_fields if t and isinstance(t, str)).strip()
    if not combined:
        return None

    # 1) direct pattern rules
    for pattern, reason in _RULES:
        if pattern.search(combined):
            return reason

    # 2) fever + skin/hair symptom co-occurrence rule (in any order within same text)
    if _FEVER_TERMS.search(combined) and _SKIN_SYMPTOM_TERMS.search(combined):
        return "fever_with_skin_symptom"

    return None


def is_blocked(text_fields: Optional[List[str]]) -> bool:
    return check_medical_urgency(text_fields) is not None
