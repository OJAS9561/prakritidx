"""Backend tests for PrakritiDx API."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session_id():
    return f"TEST-{uuid.uuid4().hex[:12]}"


# ---------- Health ----------
class TestHealth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["service"] == "prakritidx"
        assert "time" in data


# ---------- Quiz endpoints ----------
class TestQuiz:
    def test_get_quiz_skin(self):
        r = requests.get(f"{API}/quiz/skin", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["category"] == "skin"
        assert data["total"] == 12
        assert len(data["questions"]) == 12
        # Verify skin-specific label + surface interpolation
        q1 = data["questions"][0]
        assert q1["id"] == "q1"
        assert "skin" in q1["prompt"].lower()
        assert "{surface}" not in q1["prompt"]
        opts = q1["options"]
        assert len(opts) == 3
        assert {o["value"] for o in opts} == {"vata", "pitta", "kapha"}
        # Skin-specific label content
        vata_opt = next(o for o in opts if o["value"] == "vata")
        assert "flaky" in vata_opt["label"].lower() or "thin" in vata_opt["label"].lower()

    def test_get_quiz_hair(self):
        r = requests.get(f"{API}/quiz/hair", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["category"] == "hair"
        assert data["total"] == 12
        q1 = data["questions"][0]
        assert "hair" in q1["prompt"].lower()
        assert "{surface}" not in q1["prompt"]
        vata_opt = next(o for o in q1["options"] if o["value"] == "vata")
        assert "frizzy" in vata_opt["label"].lower() or "breakage" in vata_opt["label"].lower()

    def test_get_quiz_invalid_category(self):
        r = requests.get(f"{API}/quiz/nails", timeout=15)
        assert r.status_code in (400, 422)


class TestQuizSubmit:
    def test_submit_valid_vata(self, session_id):
        answers = [{"question_id": f"q{i}", "value": "vata"} for i in range(1, 13)]
        r = requests.post(
            f"{API}/quiz/submit",
            json={"session_id": session_id, "category": "skin", "answers": answers},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["primary_dosha"] == "vata"
        assert data["scores"]["vata"] == 12
        assert data["scores"]["pitta"] == 0
        assert data["scores"]["kapha"] == 0
        assert data["dosha_label"] == "Vata"
        assert data["session_id"] == session_id
        assert data["category"] == "skin"

    def test_submit_dual_dosha(self):
        # 6 vata + 5 pitta + 1 kapha => Vata-Pitta (diff=1 within 2)
        sid = f"TEST-{uuid.uuid4().hex[:12]}"
        answers = (
            [{"question_id": f"q{i}", "value": "vata"} for i in range(1, 7)]
            + [{"question_id": f"q{i}", "value": "pitta"} for i in range(7, 12)]
            + [{"question_id": "q12", "value": "kapha"}]
        )
        r = requests.post(
            f"{API}/quiz/submit",
            json={"session_id": sid, "category": "skin", "answers": answers},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["primary_dosha"] == "vata"
        assert data["secondary_dosha"] == "pitta"
        assert data["dosha_label"] == "Vata-Pitta"

    def test_submit_too_few_answers(self, session_id):
        answers = [{"question_id": f"q{i}", "value": "vata"} for i in range(1, 4)]
        r = requests.post(
            f"{API}/quiz/submit",
            json={"session_id": session_id, "category": "skin", "answers": answers},
            timeout=15,
        )
        assert r.status_code == 400


# ---------- Ingredients ----------
class TestIngredients:
    def test_skin_vata(self):
        r = requests.get(f"{API}/ingredients/skin/vata", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["category"] == "skin"
        assert data["dosha"] == "vata"
        assert len(data["items"]) >= 3
        item = data["items"][0]
        assert "name" in item and "sanskrit" in item and "benefit" in item

    def test_hair_kapha(self):
        r = requests.get(f"{API}/ingredients/hair/kapha", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["category"] == "hair"
        assert data["dosha"] == "kapha"
        assert len(data["items"]) >= 3
        assert all("name" in it for it in data["items"])


# ---------- Results retrieval ----------
class TestResults:
    def test_get_session_results(self, session_id):
        r = requests.get(f"{API}/results/{session_id}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["session_id"] == session_id
        assert isinstance(data["results"], list)
        assert len(data["results"]) >= 1
        # Most recent first
        assert data["results"][0]["session_id"] == session_id
        assert data["results"][0]["category"] == "skin"


# ---------- Recommendations (AI) ----------
class TestRecommendations:
    def test_recommendations_generate_and_cache(self):
        sid = f"TEST-{uuid.uuid4().hex[:12]}"
        payload = {
            "session_id": sid,
            "category": "skin",
            "primary_dosha": "vata",
            "secondary_dosha": None,
        }
        t0 = time.time()
        r = requests.post(f"{API}/recommendations", json=payload, timeout=90)
        d1 = time.time() - t0
        assert r.status_code == 200, f"Failed: {r.status_code} {r.text[:400]}"
        data = r.json()

        # Structural validation
        assert data["summary"] and isinstance(data["summary"], str)
        assert isinstance(data["routine"], list) and 4 <= len(data["routine"]) <= 8
        for step in data["routine"]:
            assert "time" in step and "step" in step and "why" in step
        assert isinstance(data["key_ingredients"], list) and len(data["key_ingredients"]) >= 1
        assert isinstance(data["avoid"], list) and len(data["avoid"]) >= 1
        assert isinstance(data["do"], list) and len(data["do"]) >= 1
        assert isinstance(data["dont"], list) and len(data["dont"]) >= 1
        assert isinstance(data["herbs"], list) and len(data["herbs"]) >= 1
        assert data["dosha_label"] == "Vata"

        # Second call should be cached (fast, same content)
        t0 = time.time()
        r2 = requests.post(f"{API}/recommendations", json=payload, timeout=30)
        d2 = time.time() - t0
        assert r2.status_code == 200
        data2 = r2.json()
        assert data2["summary"] == data["summary"]
        # cached should be significantly faster than first (allow leeway)
        print(f"first call: {d1:.2f}s | cached call: {d2:.2f}s")
        assert d2 < max(5.0, d1 * 0.6)


# ---------- Meta ----------
class TestMeta:
    def test_dosha_meta(self):
        r = requests.get(f"{API}/dosha/meta", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) == {"vata", "pitta", "kapha"}
        for k in data:
            assert "element" in data[k] and "quality" in data[k] and "color" in data[k]
