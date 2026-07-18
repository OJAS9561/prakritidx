"""Backend tests for PrakritiDx v2 API.

Covers:
- /api/health
- /api/intake/{skin,hair}
- /api/upload/selfie, /api/upload/lab-report
- /api/intake/submit safety hard-block (all trigger categories)
- /api/free-hook (AI teaser + belt-and-suspenders safety re-check)
- /api/report/full 402 without payment
- /api/payments/create-link 503 without Razorpay keys
- /api/payments/create-link 400 for safety-blocked session
- /api/payments/status simulated single & combo
- /api/report/full after simulated payment (AI GPT-4o) + caching
"""
import os
import io
import time
import uuid
import base64
import pytest
import requests
from PIL import Image
from pymongo import MongoClient


# --------------------------- Config ---------------------------
def _load_env(path, keys):
    out = {}
    try:
        with open(path) as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip()
                    if k in keys:
                        out[k] = v
    except FileNotFoundError:
        pass
    return out


_fe_env = _load_env("/app/frontend/.env", {"REACT_APP_BACKEND_URL"})
_be_env = _load_env("/app/backend/.env", {"MONGO_URL", "DB_NAME"})

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _fe_env.get("REACT_APP_BACKEND_URL", "")).rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL") or _be_env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or _be_env.get("DB_NAME") or "prakritidx"

_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


# --------------------------- Helpers --------------------------
def _make_jpeg_bytes(size=(320, 320), color=(200, 120, 90)):
    """Real JPEG with visible gradient + shapes so vision models don't reject."""
    img = Image.new("RGB", size, color)
    px = img.load()
    for x in range(size[0]):
        for y in range(size[1]):
            r = min(255, color[0] + (x % 60) - 30)
            g = min(255, color[1] + (y % 40) - 20)
            b = min(255, color[2] + ((x + y) % 50) - 25)
            px[x, y] = (max(0, r), max(0, g), max(0, b))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _make_png_bytes(size=(240, 240)):
    img = Image.new("RGB", size, (240, 220, 200))
    for x in range(0, size[0], 12):
        for y in range(0, size[1], 12):
            img.putpixel((x, y), (60, 90, 60))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="session")
def sid():
    return f"TEST-{uuid.uuid4().hex[:12]}"


@pytest.fixture(scope="session", autouse=True)
def _cleanup_at_end():
    yield
    # Wipe all TEST- data from mongo
    for coll in ("intakes", "uploads", "payments", "reports", "safety_blocks"):
        try:
            _db[coll].delete_many({"session_id": {"$regex": "^TEST-"}})
        except Exception:
            pass


# --------------------------- 1) Health -----------------------
class TestHealth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["service"] == "prakritidx"
        assert "razorpay_configured" in data
        assert isinstance(data["razorpay_configured"], bool)


# --------------------------- 2) Intake schema ----------------
class TestIntakeSchema:
    def test_intake_skin(self):
        r = requests.get(f"{API}/intake/skin", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["category"] == "skin"
        qs = data["questions"]
        assert len(qs) == 7
        assert [q["id"] for q in qs] == [f"q{i}" for i in range(1, 8)]
        # q1-q6 multi_select, q7 free_text
        for i in range(6):
            assert qs[i]["type"] == "multi_select"
        assert qs[6]["type"] == "free_text"
        # SKIN-specific q1 options
        q1_labels = " ".join(o["label"].lower() for o in qs[0]["options"])
        assert "t-zone" in q1_labels
        assert "jawline" in q1_labels and "chin" in q1_labels
        assert "cheeks" in q1_labels

    def test_intake_hair(self):
        r = requests.get(f"{API}/intake/hair", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["category"] == "hair"
        qs = data["questions"]
        assert len(qs) == 7
        q1_labels = " ".join(o["label"].lower() for o in qs[0]["options"])
        assert "receding hairline" in q1_labels
        assert "thinning at the crown" in q1_labels
        assert "round bald patches" in q1_labels

    def test_q5_q6_shared_between_skin_and_hair(self):
        skin = requests.get(f"{API}/intake/skin", timeout=15).json()["questions"]
        hair = requests.get(f"{API}/intake/hair", timeout=15).json()["questions"]
        assert skin[4] == hair[4]  # q5
        assert skin[5] == hair[5]  # q6


# --------------------------- 3) Uploads ----------------------
class TestUploads:
    def test_upload_selfie_ok(self, sid):
        files = {"file": ("selfie.jpg", _make_jpeg_bytes(), "image/jpeg")}
        r = requests.post(
            f"{API}/upload/selfie",
            data={"session_id": sid},
            files=files,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["upload_id"].startswith("selfie_")
        assert data["mime"] == "image/jpeg"

    def test_upload_selfie_rejects_bad_mime(self, sid):
        files = {"file": ("bad.txt", b"hello world", "text/plain")}
        r = requests.post(
            f"{API}/upload/selfie",
            data={"session_id": sid},
            files=files,
            timeout=15,
        )
        assert r.status_code == 400

    def test_upload_lab_report_png(self, sid):
        files = {"file": ("lab.png", _make_png_bytes(), "image/png")}
        r = requests.post(
            f"{API}/upload/lab-report",
            data={"session_id": sid},
            files=files,
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["upload_id"].startswith("lab_")

    def test_upload_lab_report_pdf(self, sid):
        pdf_bytes = b"%PDF-1.4\n%TEST\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
        files = {"file": ("lab.pdf", pdf_bytes, "application/pdf")}
        r = requests.post(
            f"{API}/upload/lab-report",
            data={"session_id": sid},
            files=files,
            timeout=15,
        )
        assert r.status_code == 200

    def test_upload_lab_report_bad_mime(self, sid):
        files = {"file": ("bad.svg", b"<svg/>", "image/svg+xml")}
        r = requests.post(
            f"{API}/upload/lab-report",
            data={"session_id": sid},
            files=files,
            timeout=15,
        )
        assert r.status_code == 400


# --------------------------- 4) Safety hard-block --------------
EXPECTED_BLOCK_MESSAGE = (
    "This sounds like something that needs a doctor's attention rather than a "
    "lifestyle routine. Please consult a physician or visit a clinic — PrakritiDx "
    "isn't able to safely guide you on this. If it's urgent, please seek immediate "
    "medical care."
)


def _submit(session_id, category, chat_text=None, med_text=None, answers=None):
    ans = answers or []
    if med_text:
        ans = ans + [{"question_id": "q7", "values": [], "free_text": med_text}]
    return requests.post(
        f"{API}/intake/submit",
        json={
            "session_id": session_id,
            "category": category,
            "chat_text": chat_text,
            "answers": ans,
        },
        timeout=15,
    )


class TestSafetyBlock:
    @pytest.mark.parametrize("phrase,expected_reason", [
        ("my scalp has been bleeding for weeks", "bleeding"),
        ("I got a chemical burn on my cheek", "chemical_burn"),
        ("my baby has a rash all over her back", "child_symptom"),
        ("I have a rash and 101 fever", "fever_with_skin_symptom"),
        ("my mole has been changing shape and color", "mole_changing"),
        ("I was diagnosed with autoimmune lupus last year", "diagnosed_serious"),
    ])
    def test_block_via_chat(self, phrase, expected_reason):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        # include many valid MCQ answers to prove they can't bypass
        answers = [{"question_id": f"q{i}", "values": ["stress"]} for i in range(1, 7)]
        r = _submit(s, "skin", chat_text=phrase, answers=answers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["blocked"] is True, f"phrase '{phrase}' should have been blocked"
        assert data["reason"] == expected_reason
        assert data["message"] == EXPECTED_BLOCK_MESSAGE

    def test_block_via_q7_free_text(self):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        r = _submit(
            s, "skin",
            chat_text="my cheeks are mildly red sometimes",
            med_text="I was diagnosed with melanoma cancer 2 years ago",
        )
        data = r.json()
        assert data["blocked"] is True
        assert data["reason"] == "diagnosed_serious"

    def test_benign_intake_passes(self):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        answers = [
            {"question_id": "q1", "values": ["cheeks"]},
            {"question_id": "q2", "values": ["1_6m"]},
            {"question_id": "q3", "values": ["red_bumps"]},
            {"question_id": "q4", "values": ["spicy_oily_food"]},
            {"question_id": "q5", "values": ["acid_reflux"]},
            {"question_id": "q6", "values": ["high_stress"]},
        ]
        r = _submit(s, "skin", chat_text="cheeks get red when I eat spicy food", answers=answers)
        assert r.status_code == 200
        data = r.json()
        assert data["blocked"] is False


# --------------------------- 5) Free hook -----------------------
BENIGN_ANSWERS_SKIN = [
    {"question_id": "q1", "values": ["cheeks"]},
    {"question_id": "q2", "values": ["1_6m"]},
    {"question_id": "q3", "values": ["red_bumps"]},
    {"question_id": "q4", "values": ["spicy_oily_food", "stress"]},
    {"question_id": "q5", "values": ["acid_reflux"]},
    {"question_id": "q6", "values": ["high_stress"]},
]


class TestFreeHook:
    def test_free_hook_after_benign_intake(self):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        r = _submit(s, "skin", chat_text="my cheeks get warm and red after spicy meals", answers=BENIGN_ANSWERS_SKIN)
        assert r.status_code == 200 and r.json()["blocked"] is False

        r = requests.post(
            f"{API}/free-hook",
            json={"session_id": s, "category": "skin"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("blocked") is False
        assert data["dosha"] in {"vata", "pitta", "kapha"}
        assert data["dosha_label"] == data["dosha"].capitalize()
        assert isinstance(data["frame"], str) and len(data["frame"]) > 20
        assert isinstance(data["teaser"], str) and len(data["teaser"]) > 3
        assert data["hook"].startswith(data["frame"])
        # hook must NOT contain forbidden structures (lists/steps)
        low = data["hook"].lower()
        assert "\n-" not in data["hook"] and "\n*" not in data["hook"]
        for kw in ["step 1", "step 2", "morning:", "evening:", "ingredients:"]:
            assert kw not in low, f"teaser leaked routine keyword: {kw}"

    def test_free_hook_for_safety_blocked_session(self):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        r = _submit(s, "skin", chat_text="my scalp has been bleeding for days", answers=BENIGN_ANSWERS_SKIN)
        assert r.status_code == 200 and r.json()["blocked"] is True
        # Even though intake was blocked (no intake doc), free-hook should 404
        r2 = requests.post(f"{API}/free-hook", json={"session_id": s, "category": "skin"}, timeout=15)
        # Either 404 (no intake persisted) OR blocked payload — both acceptable belt+suspenders
        assert r2.status_code in (200, 404)
        if r2.status_code == 200:
            assert r2.json().get("blocked") is True

    def test_free_hook_belt_suspenders_recheck(self):
        """Manually seed an intake with a red-flag phrase so we prove
        free-hook re-checks safety even if intake somehow persisted."""
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        _db.intakes.replace_one(
            {"session_id": s, "category": "skin"},
            {
                "session_id": s,
                "category": "skin",
                "chat_text": "there's chemical burn on my cheek",
                "answers": BENIGN_ANSWERS_SKIN,
                "selfie_upload_id": None,
                "lab_upload_id": None,
                "selfie_b64": None,
                "lab_b64": None,
                "lab_mime": None,
                "submitted_at": "2026-01-01T00:00:00+00:00",
            },
            upsert=True,
        )
        r = requests.post(f"{API}/free-hook", json={"session_id": s, "category": "skin"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("blocked") is True
        assert data["reason"] == "chemical_burn"
        assert data["message"] == EXPECTED_BLOCK_MESSAGE


# --------------------------- 6) Payments -----------------------
class TestPaymentsGating:
    def test_full_report_402_without_payment(self):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        # Submit benign intake first so intake exists
        _submit(s, "skin", chat_text="mild redness", answers=BENIGN_ANSWERS_SKIN)
        r = requests.post(f"{API}/report/full", json={"session_id": s, "category": "skin"}, timeout=15)
        assert r.status_code == 402
        assert "payment" in r.text.lower()

    def test_create_link_returns_503_when_razorpay_not_configured(self):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        r = requests.post(
            f"{API}/payments/create-link",
            json={"session_id": s, "plan": "single", "category": "skin"},
            timeout=15,
        )
        # only relevant when keys are actually missing
        health = requests.get(f"{API}/health", timeout=15).json()
        if not health.get("razorpay_configured"):
            assert r.status_code == 503
            assert "not configured" in r.text.lower() or "razorpay" in r.text.lower()
        else:
            assert r.status_code in (200, 500)  # actual call may succeed

    def test_create_link_400_for_safety_blocked_session(self):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        # Trigger a safety block first
        r = _submit(s, "skin", chat_text="bleeding scalp for weeks")
        assert r.status_code == 200 and r.json()["blocked"] is True
        # Now try to create payment link → must be 400
        r2 = requests.post(
            f"{API}/payments/create-link",
            json={"session_id": s, "plan": "single", "category": "skin"},
            timeout=15,
        )
        assert r2.status_code == 400
        assert "safety" in r2.text.lower()


class TestPaymentsStatusSimulated:
    def test_status_single_skin(self):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        _db.payments.insert_one({
            "reference_id": f"pdx_test_{uuid.uuid4().hex[:8]}",
            "session_id": s,
            "plan": "single",
            "category": "skin",
            "amount": 9900,
            "status": "paid",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        r = requests.get(f"{API}/payments/status/{s}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["unlocked"]["skin"] is True
        assert d["unlocked"]["hair"] is False
        assert d["combo_paid"] is False

    def test_status_combo(self):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        _db.payments.insert_one({
            "reference_id": f"pdx_test_{uuid.uuid4().hex[:8]}",
            "session_id": s,
            "plan": "combo",
            "category": "skin",
            "amount": 14900,
            "status": "paid",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        r = requests.get(f"{API}/payments/status/{s}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["unlocked"]["skin"] is True
        assert d["unlocked"]["hair"] is True
        assert d["combo_paid"] is True


# --------------------------- 7) Full report (AI) --------------
class TestFullReport:
    @pytest.fixture(scope="class")
    def paid_session(self):
        s = f"TEST-{uuid.uuid4().hex[:10]}"
        # Upload a selfie
        files = {"file": ("selfie.jpg", _make_jpeg_bytes(), "image/jpeg")}
        up = requests.post(f"{API}/upload/selfie", data={"session_id": s}, files=files, timeout=15)
        selfie_id = up.json()["upload_id"] if up.status_code == 200 else None

        # Submit benign intake
        payload = {
            "session_id": s,
            "category": "skin",
            "chat_text": "cheeks get red and warm when I eat spicy food, worse in summer",
            "answers": BENIGN_ANSWERS_SKIN,
            "selfie_upload_id": selfie_id,
            "lab_upload_id": None,
        }
        r = requests.post(f"{API}/intake/submit", json=payload, timeout=15)
        assert r.status_code == 200 and r.json()["blocked"] is False

        # Simulate paid state via direct mongo insert
        _db.payments.insert_one({
            "reference_id": f"pdx_test_{uuid.uuid4().hex[:8]}",
            "session_id": s,
            "plan": "single",
            "category": "skin",
            "amount": 9900,
            "status": "paid",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        return s

    def test_full_report_after_payment(self, paid_session):
        t0 = time.time()
        r = requests.post(
            f"{API}/report/full",
            json={"session_id": paid_session, "category": "skin"},
            timeout=120,
        )
        d1 = time.time() - t0
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("dosha") in {"vata", "pitta", "kapha"}
        assert data["dosha_label"] == data["dosha"].capitalize()
        assert isinstance(data["constitution_read"], str) and len(data["constitution_read"]) > 30
        assert isinstance(data["routine"], list) and 5 <= len(data["routine"]) <= 8
        for step in data["routine"]:
            assert "time" in step and "step" in step and "why" in step
        assert isinstance(data["key_ingredients"], list) and 5 <= len(data["key_ingredients"]) <= 8
        assert isinstance(data["diet"], dict)
        assert "favor" in data["diet"] and "reduce" in data["diet"]
        assert len(data["diet"]["favor"]) >= 3
        assert len(data["diet"]["reduce"]) >= 3
        assert isinstance(data["daily_practice"], list) and len(data["daily_practice"]) >= 3
        assert isinstance(data["avoid"], list) and len(data["avoid"]) >= 3
        assert isinstance(data["herbs"], list) and len(data["herbs"]) >= 2
        assert isinstance(data["when_to_see_doctor"], list) and len(data["when_to_see_doctor"]) >= 1
        assert "vision_notes" in data  # may be empty string if no photo
        assert "lab_notes" in data
        print(f"First full report generation: {d1:.2f}s")

        # Second call → cached, fast
        t0 = time.time()
        r2 = requests.post(
            f"{API}/report/full",
            json={"session_id": paid_session, "category": "skin"},
            timeout=15,
        )
        d2 = time.time() - t0
        assert r2.status_code == 200
        data2 = r2.json()
        assert data2["constitution_read"] == data["constitution_read"]
        print(f"Cached full report: {d2:.2f}s")
        assert d2 < 3.0, f"cached call too slow: {d2}s"
