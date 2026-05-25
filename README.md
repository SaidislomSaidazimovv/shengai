# Mirror

Hear yourself speak perfect Mandarin — diagnosed by your L1.

Mirror is a single-screen Mandarin pronunciation tool aimed at Russian and Uzbek speakers. The app records your attempt, names the specific L1-driven articulatory error, and plays back your own cloned voice saying the sentence correctly.

- Live: https://mirroraii.vercel.app
- Repo: https://github.com/SaidislomSaidazimovv/mirror

## The Problem

Mainstream language apps grade Mandarin speakers with a green tick that says nothing. Russian and Uzbek learners get the same generic feedback as everyone else; their actual L1-driven articulation errors (palatalized retroflexes, missing /ü/) are never named. After months of practice, the same mistakes stay.

## The Loop

A single-screen flow that runs end-to-end without leaving the page.

1. SPEAK — read a Mandarin sentence into the mic.
2. DIAGNOSE — an L1-specific phoneme card lands with the offending sound, an expected-versus-detected box, and a pattern citation.
3. GOLDEN VOICE — the user's own cloned voice plays the same sentence in perfect Mandarin, with a 0.1×–2× playback rate selector.
4. AVATAR MIRROR — a synthetic native-mouth target on the left, the user's live face-mesh on the right, with a match score derived from real lip openness.

Before the first attempt, a mandatory Step 0 captures a short reference clip in the user's native language so the voice clone is seeded from clean timbre, not their accented Mandarin.

## Current Features

Everything below is wired and running in production on the live URL.

- Four-step state machine driven by Zustand, fully keyboard-driven (Space hold to record, Enter to advance, Escape to reset).
- Dual-provider ASR: browser Web Speech API as the primary path, HuggingFace Whisper Large V3 as the server fallback when the browser engine is unavailable or returns nothing.
- Real character-level mismatch derivation: the first wrong hanzi maps to its signature phoneme, and that phoneme drives the diagnosis card.
- L1-aware diagnosis card: pulsing dot, "L1 PATTERN DETECTED" label, "RUSSIAN L1" / "UZBEK L1" headline, phoneme-shift box driven by the live ASR diff against an L1 substitution table, pattern counter, citation, internal stagger.
- Gemini 2.0 Flash AI Tutor panel under the diagnosis card with a UZ / RU / EN toggle. An instant phoneme × L1 × language library paints the panel the moment analysis completes; the live Gemini response upgrades it when ready.
- ElevenLabs Flash v2.5 Instant Voice Cloning. The reference clip is required up-front — the mic stays disabled until a clone is captured — so every Golden Voice playback uses the actual speaker's timbre. A short "Skip with demo voice" CTA is available for quick walkthroughs; clone slots are released on tab close to keep the workspace under quota.
- Eight-rate playback selector on Golden Voice (0.1×, 0.2×, 0.3×, 0.4×, 0.5×, 1×, 1.5×, 2×) with preservesPitch enabled so slow rates don't pitch-shift.
- MediaPipe Tasks-Vision Face Landmarker on the live side of the mirror (468 face landmarks at 60 fps). The left side shows a synthetic 468-point Mandarin avatar with FACEMESH-style tessellation lines and a procedural mouth-open envelope synced to the sentence.
- Honest match score: zero credit for a closed mouth and an 8-frame sustained-window peak so a one-frame spike never locks in a fake high score. The Mirror percentage displayed on screen is the same value the RESOLVED report records.
- Numeric RESOLVED screen: real recording duration, ASR-confidence-weighted Speak coverage, character-level coverage, audio listened %, and peak mirror alignment.
- Honest no-speech state: when both ASR paths return empty, the app routes to a dedicated screen with the actual upstream reason rather than fabricating a diagnosis.
- Session persistence (l1, sentence, tutor language); fresh reference capture every page load.

## Roadmap

These are scoped but not in the production build yet.

- Custom sentence input: user writes in RU / UZ / EN; the backend translates to Mandarin, generates pinyin and the L1-specific diagnosis on the fly, with a small library of the user's last few sentences kept in localStorage.
- Realistic 3D talking avatar with morph-target-driven mouth animation, replacing the 2D synthetic mesh.
- Mirror Live: real-time accent morphing between two speakers via streaming ElevenLabs Flash v2.5, targeting sub-75 ms latency.
- Gemini-powered Session Report on the Resolved screen: coverage percentage, strengths, weak phoneme, and a one-line "next focus".
- Native Mandarin pre-recorded avatar landmark JSON for the left mirror panel.
- Adaptive practice: Gemini generates new Mandarin sentences targeting the user's identified weakness pattern.
- More L1 coverage beyond Russian and Uzbek.
- B2B API: license the L1-fingerprint engine to EdTech platforms.
- Self-hosted PP Neue Montreal (the build currently uses Switzer as the licensed fallback).

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React 19 + TypeScript + Tailwind v4 |
| State | Zustand (single global session, persist middleware for prefs) |
| Motion | Motion (formerly Framer Motion) |
| Audio capture | MediaRecorder + AnalyserNode (single mic stream) |
| ASR primary | Browser Web Speech API (zh-CN) |
| ASR fallback | HuggingFace Whisper Large V3 via /api/asr |
| Voice cloning | ElevenLabs Flash v2.5 + Instant Voice Cloning via /api/clone, /api/synth, /api/clone_delete |
| AI Tutor | Google Gemini 2.0 Flash via /api/explain |
| Face tracking | MediaPipe Tasks-Vision Face Landmarker |
| Backend | Vercel Python serverless functions (proxies that hide HF / ElevenLabs / Gemini keys) |
| Deploy | Vercel — one repo, frontend + serverless |

## Local Setup

Requires Node.js 20+ and Python 3.12+ for the serverless functions.

```bash
git clone https://github.com/SaidislomSaidazimovv/mirror.git
cd mirror/web
npm install
```

Create `.env` at the repository root with the keys you have (none of them are required to boot the app — missing keys degrade gracefully):

```env
HF_TOKEN=your_huggingface_token_here
HF_ASR_ENDPOINT=https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3

ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_MODEL=eleven_flash_v2_5

GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-2.0-flash

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

Run:

```bash
# Frontend only — ASR will use the browser engine and fall back gracefully
npm run dev                # http://localhost:5173

# Full stack — frontend + serverless functions on one port
npm i -g vercel
vercel dev                 # http://localhost:3000
```

## Why This Is Honest

The phoneme trigger is derived from real ASR. Whisper Large V3 or the browser engine returns Mandarin, which Mirror diffs against the expected sentence character by character. The first mismatching character maps to its signature phoneme, and that phoneme drives the analysis grid and the diagnosis card. The L1 label is taken from the user's manual language toggle, not from the audio.

The diagnosis copy is grounded in published phonetic literature, with citations on the card. The on-screen match score is the same raw alignment the RESOLVED report records; there is no display-only multiplier.

If the mic heard nothing, the app routes to NO SPEECH DETECTED instead of inventing an error.

No audio is persisted server-side. The reference clip goes to ElevenLabs once for cloning, the target attempt goes to HuggingFace for ASR; neither is stored. Voice clone slots are released when the tab closes. Mirror makes no medical, learning-outcome, or grading claims.

## License

MIT. See `LICENSE`.

Built in Tashkent.
