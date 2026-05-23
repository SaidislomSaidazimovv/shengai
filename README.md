# ShengAI 声AI

> AI-powered Mandarin Chinese pronunciation trainer with real-time pitch curve analysis, per-phoneme scoring, and adaptive drilling. Built for the **Build with AI EdTech Hackathon 2026** (General Education track).

**Live demo:** _to be added after Vercel deploy_
**Track:** General Education
**Team:** _add team members here_

---

## The Problem

Mainstream language apps (Duolingo, Babbel) fail at Mandarin **tones**. Learners get false-positive feedback — the app says "correct" even when pronunciation is wrong. Result: years of fossilized bad habits. Specialized tools exist (TonePerfect, CPAIT, Speechling) but each solves only part of the problem, are mobile-only, English-only, and lack adaptive drilling based on a learner's specific weaknesses.

## Our Solution

A **web-based** (no install), **fully responsive** pronunciation trainer that combines:

1. **Real-time pitch curve overlay** — your voice vs. a native speaker, side-by-side
2. **Per-syllable diagnosis** — initial / final / tone scored separately (not just "good/bad")
3. **Adaptive drill engine** — content is selected based on *your* error patterns, not a fixed path
4. **Native-language AI tutor** — Gemini explains mistakes in Uzbek / Russian / English

## Differentiation vs Competitors

| Feature | Duolingo | HelloChinese | TonePerfect | **ShengAI** |
|---|---|---|---|---|
| Pitch curve overlay | ❌ | ❌ | ✅ | ✅ |
| Per-phoneme scoring | ❌ | partial | ✅ | ✅ |
| Adaptive (error-based) | ❌ | ❌ | partial | ✅ |
| Uzbek / RU / EN tutor | ❌ | ❌ | ❌ | ✅ |
| Web-based | ❌ | ❌ | ✅ | ✅ |
| Free diagnostic, no signup | ❌ | ❌ | ✅ | ✅ |

---

## Tech Stack

**Frontend** (`web/`)
- React 19 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- React Router v6
- Zustand (state)
- Web Audio API (recording)
- Pitchy.js (YIN pitch detection, client-side)
- Recharts (pitch curve visualization)

**Backend** (`api/`) — Vercel Python Serverless
- Python 3.11
- NumPy (DTW for pitch comparison)
- google-generativeai (Gemini 2.0 Flash)

**Auth + Sync** (optional)
- Firebase Auth (Google sign-in)
- Firestore (cross-device attempt history)
- Falls back to localStorage when Firebase env vars are absent

**Deploy:** Vercel (frontend + serverless API in one repo)

---

## Setup & Run

### Prerequisites
- Node.js 20+ and npm
- Python 3.11+
- A Google AI Studio API key for Gemini ([get one free here](https://aistudio.google.com/app/apikey))

### 1. Clone & install

```bash
git clone <this-repo-url>
cd shengai

# Frontend
cd web
npm install

# Backend (optional for local dev — Vercel deploys it automatically)
cd ../api
pip install -r requirements.txt
```

### 2. Environment variables

Copy `.env.example` to `.env` files:

```bash
cp .env.example web/.env
cp .env.example api/.env
```

Fill in your real `GEMINI_API_KEY` in `api/.env`. The frontend `.env` needs no secrets for local dev.

### 3. Run locally

```bash
# Terminal 1 — frontend
cd web
npm run dev
# → http://localhost:5173

# Terminal 2 — backend (optional, fallback works without it)
cd api
uvicorn index:app --reload --port 8000
# → http://localhost:8000
```

### 4. (Optional) Firebase setup for sign-in + sync

Without Firebase the app works fully — progress lives in `localStorage`. To
enable Google sign-in and cross-device sync:

1. Create a project at [Firebase Console](https://console.firebase.google.com).
2. **Build → Authentication → Sign-in method** → enable **Google**.
3. **Build → Firestore Database** → create database (production mode).
4. Copy security rules from `firestore.rules` into the **Rules** tab and publish.
5. **Project Settings → Your apps → Web app** → copy the config keys into
   `web/.env`:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=<project-id>
   VITE_FIREBASE_APP_ID=...
   ```

6. Add your production domain (e.g. `<your-app>.vercel.app`) to
   **Authentication → Settings → Authorized domains**.

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add the following in the Vercel dashboard → Settings → Environment Variables:
- `GEMINI_API_KEY` (Production, Preview, Development)
- `GEMINI_MODEL=gemini-2.0-flash`
- `ALLOWED_ORIGINS=https://<your-app>.vercel.app,http://localhost:5173`
- All `VITE_FIREBASE_*` vars (if using Firebase)

---

## AI & External Asset Disclosure

Per Hackathon rules (§10 Responsible AI, §6 disclosure):

| Component | What it is | Where it's used | Why |
|---|---|---|---|
| **Google Gemini 2.0 Flash** | LLM via `google-generativeai` SDK | `api/explain.py` — generates pronunciation feedback in user's native language | Translates raw pitch/phoneme scores into actionable advice |
| **Pitchy.js** | Open-source YIN pitch detector (MIT) | `web/src/lib/pitch.ts` — client-side pitch extraction | Real-time pitch curve, no backend needed |
| **Web Audio API** | Browser native | `web/src/lib/audio.ts` — microphone capture | Standard browser audio recording |
| **DTW (Dynamic Time Warping)** | Custom NumPy implementation | `api/score.py` — compares user pitch curve to reference | Scoring tone accuracy |
| **shadcn/ui** | Open-source React components (MIT) | `web/src/components/ui/` | UI primitives |
| **Firebase Auth + Firestore** | Google BaaS | `web/src/lib/firebase.ts` | Optional Google sign-in + cross-device attempt sync |
| **Pinyin reference data** | Public pinyin syllable table | `web/src/lib/data.ts` | 21 initials × 38 finals chart |
| **Native audio samples** | Browser `SpeechSynthesis` API for demo | n/a | Reference pronunciation playback |

**No private data, no user data sent to third parties beyond Gemini for the explanation text. No medical / grading / child-safety claims.**

### Prompts used

`api/explain.py` uses a structured prompt template; see source file. Prompts are versioned in the repo.

### Limitations

- Pitch detection accuracy depends on microphone quality and ambient noise. Headset recommended.
- Initial/final scoring is heuristic (energy envelope + spectral features), not a trained phoneme classifier. We document this as a known limitation rather than overclaim.
- Gemini explanations are LLM-generated and may occasionally be imprecise. Falls back to template-based feedback if API is unavailable.
- Free tier limits apply (10 daily assessments) — designed for demo / hackathon judging.

### Fallback Behavior

If the backend `/api/explain` endpoint fails (network error, Gemini quota exceeded), the frontend automatically falls back to **template-based feedback** generated from the raw pitch/phoneme scores. The user always sees a usable result.

If the backend `/api/score` endpoint fails, the frontend computes pitch DTW **entirely client-side** using Pitchy.js. The app remains functional offline.

---

## Project Structure

```
shengai/
├── web/                  # Vite + React frontend
│   ├── src/
│   │   ├── pages/        # Landing, FreeTest, Practice, Dashboard, PinyinChart, Lesson
│   │   ├── components/   # Recorder, PitchCurve, ScoreCard, PinyinChart, Layout
│   │   ├── lib/          # audio, pitch, api, data
│   │   ├── store/        # Zustand stores
│   │   └── App.tsx
│   ├── public/audio/     # native speaker reference audio
│   └── package.json
├── api/                  # Vercel Python serverless functions
│   ├── score.py          # POST /api/score
│   ├── explain.py        # POST /api/explain
│   ├── _utils.py         # DTW, pitch helpers
│   └── requirements.txt
├── docs/                 # additional documentation
├── vercel.json           # Vercel monorepo config
├── .gitignore
├── .env.example
├── LICENSE               # MIT
└── README.md             # you are here
```

---

## Hackathon Compliance Checklist

- [x] Project started during hackathon (no pre-built solution)
- [x] Public repository with README.md
- [x] Setup/run instructions
- [x] Environment variable placeholders in `.env.example`
- [x] No real API keys committed (`.env` in `.gitignore`)
- [x] AI disclosure (Gemini, Pitchy, etc.)
- [x] Open-source license (MIT)
- [x] Fallback behavior for AI failures documented
- [x] No private data, no unverified outcome claims
- [ ] Final Google Slides link (added on submission day)

---

## License

MIT — see `LICENSE`.

Built with ❤️ at Build with AI EdTech Hackathon 2026, New Uzbekistan University.
