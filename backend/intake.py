"""
Fixed MCQ intake questions for PrakritiDx.
Skin and Hair have DIFFERENT question sets (only Q5 and Q6 are shared).
All are MULTI-SELECT. Q7 is optional FREE TEXT (not MCQ).
"""

_SHARED_Q5 = {
    "id": "q5",
    "prompt": "How would you describe your digestion?",
    "type": "multi_select",
    "options": [
        {"value": "regular_daily", "label": "Regular every day"},
        {"value": "bloating", "label": "Bloating after meals"},
        {"value": "acid_reflux", "label": "Acid reflux or burning sensation"},
        {"value": "constipation", "label": "Constipation"},
        {"value": "alternating", "label": "Alternating between loose and hard stools"},
    ],
}

_SHARED_Q6 = {
    "id": "q6",
    "prompt": "How's your sleep and stress been lately?",
    "type": "multi_select",
    "options": [
        {"value": "sleep_7plus", "label": "7+ hours consistently"},
        {"value": "sleep_under6", "label": "Under 6 hours regularly"},
        {"value": "racing_thoughts", "label": "Racing thoughts at night"},
        {"value": "high_stress", "label": "High stress most days"},
        {"value": "generally_calm", "label": "Generally calm"},
    ],
}

_MEDICAL_Q7 = {
    "id": "q7",
    "prompt": "Anything else we should know?",
    "type": "free_text",
    "helper": (
        "Please mention any of the following if they apply to you: allergies, "
        "high or low blood pressure, diabetes/sugar levels, thyroid issues, "
        "PCOS/PCOD, current medications, or any other diagnosed medical condition."
    ),
    "optional": True,
}


SKIN_QUESTIONS = [
    {
        "id": "q1",
        "prompt": "Where on your face or body is this mainly showing up?",
        "type": "multi_select",
        "options": [
            {"value": "tzone", "label": "T-zone/forehead & nose"},
            {"value": "jawline", "label": "Jawline & chin"},
            {"value": "cheeks", "label": "Cheeks"},
            {"value": "around_eyes", "label": "Around eyes"},
            {"value": "back_chest", "label": "Back/chest"},
            {"value": "scalp", "label": "Scalp"},
        ],
    },
    {
        "id": "q2",
        "prompt": "How long have you been dealing with this?",
        "type": "multi_select",
        "options": [
            {"value": "under_1m", "label": "Under 1 month"},
            {"value": "1_6m", "label": "1–6 months"},
            {"value": "6m_2y", "label": "6 months–2 years"},
            {"value": "2y_plus", "label": "2+ years"},
            {"value": "cyclical", "label": "It keeps coming back cyclically"},
        ],
    },
    {
        "id": "q3",
        "prompt": "How would you describe how it looks or feels?",
        "type": "multi_select",
        "options": [
            {"value": "flaky", "label": "Flaky or peeling patches"},
            {"value": "oily_shine", "label": "Excess oil and shine"},
            {"value": "red_bumps", "label": "Active red bumps or pimples"},
            {"value": "pigmentation", "label": "Dark spots or pigmentation"},
            {"value": "rough_bumpy", "label": "Rough or bumpy texture"},
            {"value": "dryness_cracks", "label": "Visible dryness or cracks"},
        ],
    },
    {
        "id": "q4",
        "prompt": "What tends to make it worse?",
        "type": "multi_select",
        "options": [
            {"value": "spicy_oily_food", "label": "Spicy or oily food"},
            {"value": "stress", "label": "Stress or anxiety"},
            {"value": "hot_humid", "label": "Hot and humid weather"},
            {"value": "cold_dry", "label": "Cold and dry weather"},
            {"value": "lack_of_sleep", "label": "Lack of sleep"},
            {"value": "hormonal", "label": "Hormonal cycle"},
            {"value": "no_pattern", "label": "No clear pattern I've noticed"},
        ],
    },
    _SHARED_Q5,
    _SHARED_Q6,
    _MEDICAL_Q7,
]


HAIR_QUESTIONS = [
    {
        "id": "q1",
        "prompt": "Where exactly are you noticing the issue?",
        "type": "multi_select",
        "options": [
            {"value": "receding", "label": "Receding hairline"},
            {"value": "crown_thinning", "label": "Thinning at the crown"},
            {"value": "diffuse", "label": "Diffuse thinning all over"},
            {"value": "bald_patches", "label": "Round bald patches"},
            {"value": "itchy_no_loss", "label": "Itchy scalp without hair loss"},
        ],
    },
    {
        "id": "q2",
        "prompt": "How long has this been going on?",
        "type": "multi_select",
        "options": [
            {"value": "under_1m", "label": "Under 1 month"},
            {"value": "1_6m", "label": "1–6 months"},
            {"value": "6m_2y", "label": "6 months–2 years"},
            {"value": "2y_plus", "label": "2+ years"},
            {"value": "seasonal", "label": "It's seasonal and comes back yearly"},
        ],
    },
    {
        "id": "q3",
        "prompt": "What's the main issue you're experiencing?",
        "type": "multi_select",
        "options": [
            {"value": "shedding", "label": "Excess strands falling when washing or combing"},
            {"value": "visible_scalp", "label": "Visible scalp showing through"},
            {"value": "dandruff", "label": "White flaking dandruff"},
            {"value": "oily_day2", "label": "Oily scalp by day two"},
            {"value": "dry_itchy", "label": "Dry and itchy scalp"},
            {"value": "split_breakage", "label": "Split ends or breakage"},
        ],
    },
    {
        "id": "q4",
        "prompt": "What seems to trigger it?",
        "type": "multi_select",
        "options": [
            {"value": "post_illness", "label": "After an illness or fever"},
            {"value": "high_stress", "label": "A period of high stress"},
            {"value": "poor_diet", "label": "Poor diet"},
            {"value": "seasonal_change", "label": "Seasonal change"},
            {"value": "postpartum_hormonal", "label": "Postpartum or hormonal shift"},
            {"value": "no_pattern", "label": "No clear pattern I've noticed"},
        ],
    },
    _SHARED_Q5,
    _SHARED_Q6,
    _MEDICAL_Q7,
]


def get_questions(category: str):
    return SKIN_QUESTIONS if category == "skin" else HAIR_QUESTIONS
