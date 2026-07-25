# PrakritiDx

AI-powered skin & hair guidance app blending Ayurveda with modern dermatology/trichology.
Users describe their concern (chat + optional selfie + optional lab report), answer a
short fixed questionnaire, get a free partial "hook" read of their constitution, then pay
a one-time fee for a full personalized report (routine, ingredients, diet, herbs).

**Stack:** FastAPI (Python) + MongoDB Atlas + Google Gemini (text + vision) backend,
React + Tailwind + Framer Motion frontend, Razorpay Payment Links for checkout.

## Project structure

backend/     FastAPI app (server.py), intake question sets (intake.py), safety
             short-circuit rules (safety.py)
frontend/    React app — AppShell, Landing, IntakeFlow, SafetyBlock, FreeHook,
             PayGate, FullReport
render.yaml  Render Blueprint — deploys both services in one go

## Local setup

### Backend
cd backend
cp .env.example .env      # fill in MONGO_URL, GEMINI_API_KEY, Razorpay keys
pip install -r requirements.txt
uvicorn server:app --reload

### Frontend
cd frontend
cp .env.example .env      # set REACT_APP_BACKEND_URL to http://localhost:8000
yarn install
yarn start

## Deploying to Render

1. Push this repo to GitHub (already done — OJAS9561/prakritidx).
2. In Render, choose New > Blueprint, point it at this repo. It will read
   render.yaml and create two services: prakritidx-api (backend) and
   prakritidx (frontend static site).
3. Fill in the secret env vars Render prompts for (they're marked sync: false
   in render.yaml, so Render won't guess them):
   - MONGO_URL — from MongoDB Atlas (create a free cluster, get the
     mongodb+srv://... connection string)
   - GEMINI_API_KEY — from https://aistudio.google.com/apikey (free tier,
     no credit card needed; note: free-tier inputs may be used by Google to
     improve their models — switch to a paid Gemini tier later if you want
     that turned off)
   - RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — from the Razorpay dashboard
     (use Test mode keys until you're ready to go live)
   - APP_PUBLIC_URL — the deployed frontend's URL (Render gives you this
     after the frontend service is created — you may need to set this one
     after the first deploy)
   - REACT_APP_BACKEND_URL (frontend service) — the deployed backend's URL
4. Optional: configure a Razorpay webhook pointing at
   <backend-url>/api/payments/webhook, and set RAZORPAY_WEBHOOK_SECRET to
   match what you configure there.
5. Deploy. First request to a free-tier Render service can be slow (cold
   start) — same as HOPE.

## Notes

- All AI calls (free-hook teaser + paid report generation, including vision
  on selfies and lab reports) run through the official google-genai Python
  SDK, using Gemini's free tier — no third-party proxy involved. Includes
  retry-with-backoff for transient rate-limit errors, since the free tier
  can occasionally throttle bursts.
- Razorpay is currently wired for test mode. Switch RAZORPAY_KEY_ID/
  RAZORPAY_KEY_SECRET to live keys when ready to launch.
