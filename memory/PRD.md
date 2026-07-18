# PrakritiDx — PRD

## Original Problem Statement
Build a mobile-first React app called PrakritiDx — an AI-powered skin & hair guidance app blending Ayurveda and modern science. Two main sections "Skin" and "Hair", switchable at the top and freely switchable at any time. Both sections must use the SAME reusable flow/components, parameterized by section type. Brand theme (sage/copper/gold/cream/ink), Fraunces headings + Inter body, premium & minimal (not generic wellness look). App name "PrakritiDx" + tagline "Know Your Constitution" in header.

## Architecture
- **Backend**: FastAPI (Python 3.11) + Motor (async MongoDB) + emergentintegrations (Claude Sonnet 4.5 via `claude-sonnet-4-5-20250929`)
- **Frontend**: React 18 + Tailwind CSS + Framer Motion + lucide-react
- **DB**: MongoDB collections `quiz_results`, `recommendations`
- **Session**: anonymous `session_id` in localStorage (`prakritidx:session`)
- **Per-category state persistence**: `prakritidx:state:skin` and `prakritidx:state:hair` — free switching preserves each section's stage & result independently.

## Reusability Principle
A single `<DoshaFlow category={category} />`, `<ResultsScreen category>`, `<Recommendations category>` — content and copy are parameterized by category. No duplicated Skin/Hair codebases.

## User Personas
1. **Wellness-curious millennial** — has heard of doshas, wants an actionable modern routine.
2. **Skincare/haircare enthusiast** — knows ingredients, wants Ayurvedic personalization.

## Core Requirements (static)
- Sage/copper/gold/cream/ink palette; Fraunces + Inter typography.
- Mobile-first, max-w-md constrained shell, cream background (never white).
- Skin/Hair toggle in header, sliding pill with Framer Motion.
- 12-question Prakriti quiz with per-category prompt/label interpolation.
- Dosha computation (Vata/Pitta/Kapha, dual-dosha when secondary within 2 of primary).
- AI-personalized recommendations: summary, routine (Morning/Evening/Weekly), key ingredients, do/don't, avoid list, herbs.
- Curated static Ayurvedic ingredient library seeded per (category, dosha).

## What's Been Implemented (2026-07-18)
- ✅ Backend: /api/health, /api/quiz/{category}, /api/quiz/submit, /api/recommendations (Claude Sonnet 4.5, cached in Mongo), /api/ingredients/{cat}/{dosha}, /api/dosha/meta, /api/results/{session_id}
- ✅ Frontend: AppShell (wordmark + tagline + toggle), Landing (per-category hero + copy), DoshaFlow (12-Q multi-step), ResultsScreen (dosha crest + animated score bars + dual-dosha note), Recommendations (AI content + curated library)
- ✅ Free bidirectional switching between Skin & Hair, per-category state preserved
- ✅ Framer Motion transitions + gold accent (dividers, badges) used sparingly
- ✅ All interactive elements have data-testid
- ✅ Backend + frontend: 100% test pass (12/12 backend tests, all critical frontend flows)

## Prioritized Backlog
### P1
- Save/share results (email or share-card image)
- Track routine adherence + weekly check-ins
### P2
- Photo-based AI skin/hair analysis (image upload → GPT-4o vision or Gemini)
- Ingredient shopping links (affiliate)
- Multi-language (Hindi / Tamil)
- Native mobile PWA install prompt + offline caching

## Next Tasks
- Awaiting user feedback / next feature request.
