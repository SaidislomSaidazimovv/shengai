# SHENG 声

> **Hear yourself speak perfect Mandarin — diagnosed by your L1.**

Built for the **Build with AI EdTech Hackathon 2026** · General Education track · New Uzbekistan University.

- 🔴 **Live demo:** https://sheganai.vercel.app
- 📂 **Repo:** https://github.com/SaidislomSaidazimovv/shengai
- 🌿 **Active branch:** `ovoz` (kept as deploy branch for continuity)

---

## The Problem

Mainstream language apps grade Mandarin speakers with a green tick that says nothing. Russian and Uzbek learners get the same generic feedback as everyone else — their actual L1-driven articulation errors (palatalized retroflexes, missing /ü/) are never named. After months of practice, the same mistakes stay.

## The Solution

A **single-screen, ≤10-second loop**:

1. **SPEAK** — the user reads a Mandarin sentence into the mic.
2. **DIAGNOSE** — an L1-specific phoneme error card slams in (signal red on black, hospital-reading style).
3. **GOLDEN VOICE** — the same user's cloned voice plays the sentence *correctly* (their own timbre, perfect Mandarin).
4. **MIRROR** — webcam + real lip-landmark overlay; alignment closes the gap.

A separate **Step 0 · Reference Capture** records the user reading in their native language (Russian or Uzbek) so the voice clone is seeded from clean timbre, not their accented Mandarin (see *Reference Audio Trap* below).

---

## Demo (60 seconds)

1. Open https://sheganai.vercel.app in Chrome or Edge.
2. Click the red mic and read the highlighted Mandarin sentence — speak it **badly** if you want to see the diagnosis fire.
3. The phoneme grid scans, then settles on the offending phoneme. The L1 card slams in.
4. Press *Hear yourself correct it* — the golden voice plays back the corrected sentence in the same timbre.
5. *Mirror the lips* — webcam opens, the gold lip outline tracks your face, alignment % rises in real time.

**No login. No installation. The site never stores your audio server-side.**

If you'd like to run the full loop including ElevenLabs voice cloning, capture a reference clip first using the *Capture reference* card on the home screen.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React 19 + TypeScript + Tailwind |
| State machine | Zustand (single global session) |
| Audio capture | MediaRecorder API + AnalyserNode (single mic stream) |
| **ASR (primary)** | Browser Web Speech API · `zh-CN` (Chrome/Edge/Safari) |
| **ASR (fallback)** | HuggingFace **Whisper Large V3** via `/api/asr` (Firefox or when browser engine errors out) |
| **Lip tracking** | MediaPipe Tasks-Vision · Face Landmarker (468 points, real-time) |
| **Voice cloning** | ElevenLabs Flash v2.5 + Instant Voice Cloning via `/api/clone` + `/api/synth` |
| L1 diagnosis | Hardcoded JSON keyed on (user-picked L1, demo sentence) — see *The L1 Cheat* below |
| Backend | Vercel Python serverless (proxies that hide HF + ElevenLabs keys) |
| Deploy | Vercel — one repo, frontend + serverless |

---

## Setup

### Prerequisites
- Node.js 20+
- Python 3.11+ (for `vercel dev` to run the serverless functions locally)
- A HuggingFace token (free): https://huggingface.co/settings/tokens
- An ElevenLabs API key — Starter plan or higher for Instant Voice Cloning (optional; the app degrades gracefully without it)

### Install and run locally

```bash
git clone https://github.com/SaidislomSaidazimovv/shengai.git
cd shengai
git checkout ovoz
cd web && npm install
```

Copy environment placeholders into local `.env` files (never commit real keys):

```bash
# api/.env  (server-side keys — never exposed to the browser)
HF_TOKEN=your_huggingface_token_here
HF_ASR_ENDPOINT=https://api-inference.huggingface.co/models/openai/whisper-large-v3
ELEVENLABS_API_KEY=your_elevenlabs_key_here       # optional
ELEVENLABS_MODEL=eleven_flash_v2_5
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# web/.env  (build-time only, no secrets)
VITE_API_BASE_URL=
```

The placeholders are also in `.env.example` at the repo root.

Run:

```bash
# Frontend only (no backend; ASR falls back gracefully)
cd web && npm run dev          # http://localhost:5173

# Full stack — serves frontend + serverless API on one port
npm i -g vercel
vercel dev                     # http://localhost:3000
```

For testing the HuggingFace fallback path explicitly on Chrome, open the site at `/?asr=hf` — that flag disables the browser engine.

---

## Why this is honest (Responsible AI · §10)

**A real signal triggers a scripted card.** Per the dev handover, we are not building a real L1 classifier. The phoneme trigger is derived from real ASR — Whisper Large V3 or the browser engine returns Mandarin hanzi, which we diff against the expected sentence character-by-character. The first mismatching character maps to its signature phoneme, and that phoneme is what the analysis grid highlights and the diagnosis card cites. The **L1 label** (`RUSSIAN L1 DETECTED` / `UZBEK L1 DETECTED`) is taken from the user's manual language toggle, not from the audio. The diagnosis copy is grounded in published phonetic literature; citations are in the card.

If the mic heard nothing, the app routes to a dedicated `NO SPEECH DETECTED` state instead of inventing an error.

### AI / external assets disclosure

| Component | Used in | Why |
|---|---|---|
| HuggingFace **`openai/whisper-large-v3`** | `api/asr.py` — server-side ASR fallback | Strong Mandarin transcription, free Inference API tier |
| Browser **Web Speech API** (`SpeechRecognition`, `zh-CN`) | `web/src/lib/speechRecognition.ts` — primary ASR | Sub-second, no token |
| **MediaPipe Tasks-Vision** Face Landmarker | `web/src/hooks/useLipTracker.ts` | Real-time 468-point face mesh for the mirror stage |
| **ElevenLabs Flash v2.5 + Instant Voice Cloning** | `api/clone.py`, `api/synth.py` | Sub-75ms TTS in user's own timbre |
| Hardcoded L1 → diagnosis JSON | `web/src/lib/demoData.ts` | Demo scripting; see *Why this is honest* above |
| MediaRecorder API + AnalyserNode | `web/src/lib/audio.ts` | Browser-native capture + waveform |
| shadcn/ui primitives (MIT) | `web/src/components/ui/` | Button, Card, Badge |

**No audio leaves the device beyond two clear cases:** (a) the reference clip goes to ElevenLabs once for cloning, and (b) the target attempt goes to HuggingFace for ASR. We never persist either server-side, and we make no medical / learning-outcome / grading claims.

### Reference Audio Trap

If we clone the user's voice from a recording of them speaking *bad Mandarin*, the L1 accent bleeds into the golden output and the demo dies. The fix is to capture **two** recordings per session: a short **REFERENCE** in the user's native language for cloning, and a separate **TARGET** Mandarin attempt for ASR. The Reference flow is a Step 0 sub-page; the clone is cached for the rest of the session.

---

## Known limitations (honest)

- **ElevenLabs key is optional in this build.** When unset, the golden voice falls back to a pre-rendered MP3 path (or a placeholder animation if no pre-render is available). The "your own voice" wow moment only fires when the key is configured.
- **Web Speech API needs Chrome / Edge / Safari.** Firefox drops to the Whisper Large V3 server fallback transparently.
- **L1 label is scripted**, not learned. The phoneme trigger is real; the wording is from a JSON table.
- **No persistence** — attempts live in memory for the duration of the tab.

### Failure modes

| Failure | What happens |
|---|---|
| Mic permission denied | Recorder surfaces an error with a retry button; no silent failure. |
| Web Speech API errors out | `/api/asr` (Whisper Large V3) is tried automatically. |
| Both ASR paths return empty | Routed to `NO SPEECH DETECTED` stage — no fabricated diagnosis. |
| ElevenLabs unreachable | Golden audio falls back to pre-rendered MP3 or an "Audio missing" callout. |
| Webcam denied | Mirror stage is skippable; the loop still completes. |
| MediaPipe fails to load | A `Tracker unavailable` badge appears, mirror still skippable. |

---

## License

MIT — see `LICENSE`.

Built in Tashkent · Build with AI EdTech Hackathon 2026.
