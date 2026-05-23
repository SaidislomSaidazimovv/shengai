# SHENG 声

> **Hear yourself speak perfect Mandarin — diagnosed by your L1.**
> Built for the Build with AI EdTech Hackathon 2026 · General Education track · New Uzbekistan University.

A 10-second loop: **SPEAK → DIAGNOSE → GOLDEN VOICE → MIRROR.** You read a Mandarin sentence, an L1-aware phoneme card slams in, your own cloned voice plays the corrected version, then a webcam mirror closes the lip gap.

SHENG (声 — "voice/sound" in Mandarin) is built from Tashkent, for the 200M Russian and Turkic speakers no mainstream pronunciation app bothers with.

---

## The Demo (≤10 seconds, single screen)

1. **SPEAK** — User reads the Mandarin sentence into the mic.
2. **DIAGNOSE** — `RUSSIAN L1 DETECTED · Palatalization on /zh/` slams in. Signal red on black. Three seconds held.
3. **GOLDEN VOICE** — The same person's timbre, now saying it correctly. Cloned with ElevenLabs Flash v2.5 from a separate L1 reference clip (never from the user's accented Mandarin — see the Reference Audio Trap below).
4. **MIRROR** — Webcam + target lip overlay. The user mimics until the alignment locks.

The demo screen has at most: mic button, language toggle, sentence prompt, state visuals. That's it.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React 19 + TypeScript + Tailwind |
| State | Zustand (one global session machine) |
| Audio capture | MediaRecorder API + AnalyserNode (browser-native, single stream) |
| **Speech recognition** | Browser Web Speech API (`SpeechRecognition`, `lang="zh-CN"`) is primary (sub-second on Chrome/Edge/Safari). HuggingFace **Whisper Large V3** is the fallback for Firefox or when the browser engine errors out (`/api/asr`). Either way we compare the produced transcript to the expected hanzi to drive the *real* trigger. |
| **L1 detection** | Hardcoded JSON keyed on user-picked language + demo sentence (see "The L1 Cheat" below) |
| **Voice cloning** | ElevenLabs Flash v2.5 + Instant Voice Cloning |
| **Lip tracking** | Webcam + target overlay (MediaPipe Face Mesh integration ready, falls back to static target) |
| Backend | Vercel Python serverless (proxies for ElevenLabs + reserved MDD endpoint) |
| Deploy | Vercel — one repo, frontend + serverless |

---

## The L1 Cheat (Honest Hackathon Note)

Per the developer handover §5: **we are not building a real L1 classifier.** A real speech model genuinely runs and finds a real articulation error. The L1 label and the diagnosis copy are picked from a JSON table keyed on (a) the language the user picked manually and (b) which of the three demo sentences they read.

### Why the original HF wav2vec2 plan was swapped for Web Speech API

The handover proposed `mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme` via HuggingFace Inference API. After the pivot we verified that **neither that model nor the obvious replacement** `facebook/wav2vec2-xlsr-53-espeak-cv-ft` **is deployed to the HF Inference Providers fleet** — every request fell through to a hardcoded fallback, which meant the same phoneme fired even on silence. That violates the "real signal" half of §5.

We replaced HF with the **browser-native Web Speech API**:
- Returns Mandarin hanzi for what the user actually said (no token, no cold-start, sub-second).
- We diff the transcript against the expected sentence character-by-character.
- The first mismatching character maps to its signature phoneme (per `charPhonemeIdx` in `demoData.ts`), and that phoneme is highlighted in the analysis grid and stored on the session as the trigger.
- The L1 card we slam in is still the scripted one keyed on (L1, sentence). That's the cheat — but the signal that fires it is genuine.

### What's "honest" about the result

- The phoneme highlighted on the grid is the actual phoneme of the character the user got wrong.
- The L1 label is what the user told us, not invented.
- The diagnosis text is grounded in published phonetic literature (citations in the card).
- **If the mic heard nothing, we say so.** The app routes to a dedicated `NO SPEECH DETECTED` state instead of inventing an error — see `NoSpeechStage`.

### Browser support note

Web Speech API works in Chrome, Edge, and Safari. Firefox does not implement it — in that case the app transparently falls back to **HuggingFace Whisper Large V3** via `/api/asr`. The trigger phoneme is still derived from a real transcript, just produced server-side.

Provider selection is honest: the `AnalyzingStage` shows which engine (`Web Speech API · Browser` or `Whisper Large V3 · HuggingFace`) actually produced the transcript driving the diagnosis.

---

## The Reference Audio Trap

If we clone the user's voice from a recording of them speaking bad Mandarin, their L1 accent bleeds into the "golden" output. The golden voice still sounds Russian. The demo dies.

**The fix** (per §3 of the dev handover): capture **two** recordings per session.

1. **REFERENCE** — User reads 5–10 seconds in their native language (Russian or Uzbek). Sent to ElevenLabs for cloning.
2. **TARGET** — User attempts the Mandarin sentence. Sent to HuggingFace for MDD.

The reference capture is a separate sub-flow in the app (Step 0). The clone is cached for the rest of the session.

---

## Setup

### Prerequisites
- Node.js 20+
- Python 3.11+ (for `vercel dev` to run the serverless functions locally)
- An [ElevenLabs](https://elevenlabs.io) account (Starter plan or higher — needs Instant Voice Cloning + Mandarin)
- A [HuggingFace](https://huggingface.co) account with a free read-access token

### Install

```bash
git clone https://github.com/SaidislomSaidazimovv/sheganai.git
cd sheganai
git checkout ovoz   # active branch — `main` keeps the legacy single-purpose ShengAI codebase

cd web && npm install
```

### Environment

Copy `.env.example` to `api/.env` and `web/.env`, then fill in:

```
# api/.env
ELEVENLABS_API_KEY=...
ELEVENLABS_MODEL=eleven_flash_v2_5
HF_TOKEN=...
HF_ASR_ENDPOINT=https://api-inference.huggingface.co/models/openai/whisper-large-v3

# web/.env
VITE_API_BASE_URL=
```

### Run locally

```bash
# Recommended: vercel dev — serves frontend + serverless on one port
npm i -g vercel
vercel link              # link to the Vercel project once
vercel dev               # http://localhost:3000

# Or, frontend only (uses fallbacks for HF + ElevenLabs)
cd web && npm run dev    # http://localhost:5173
```

### Deploy

```bash
vercel
```

In the Vercel dashboard → Settings → Environment Variables, add the same keys as `api/.env`. Frontend `VITE_*` vars are baked at build time, so re-deploy after adding them.

---

## What we built vs the legacy ShengAI branch

The repo started as a 6-page Mandarin pronunciation trainer with pitch curves, Firebase auth, and an adaptive drill engine on the `main` branch. After advisor review we pivoted to **SHENG**: a single-screen clinical demo, voice cloning, lip mirror. The original implementation stays on `main` as a fallback; the active build lives on the `ovoz` branch (kept as the branch name for deploy continuity).

---

## Disclosure (Hackathon §10 Responsible AI)

| Component | Where used | Why |
|---|---|---|
| **ElevenLabs Flash v2.5 + Instant Voice Cloning** | `api/clone.py`, `api/synth.py` — produces the "golden voice" | Sub-75ms TTS in user's own timbre |
| **Web Speech API (browser)** | `web/src/lib/speechRecognition.ts` — primary ASR path on Chrome/Edge/Safari | Free, no token, no cold-start, supports `zh-CN` |
| **HuggingFace Whisper Large V3** | `api/asr.py` — server-side ASR fallback when the browser engine is unavailable (Firefox) or errors out | Strong Mandarin accuracy, free Inference API tier, uses `HF_TOKEN` |
| **Hardcoded L1 diagnosis JSON** | `web/src/lib/demoData.ts` | Demo cheat per dev handover §5 — see "The L1 Cheat" above |
| **MediaPipe Face Mesh** (planned wiring) | `web/src/components/stages/MirrorStage.tsx` | Lip articulation tracking |
| **MediaRecorder API + AnalyserNode** | `web/src/lib/audio.ts` | Browser-native microphone capture + waveform analysis |
| **shadcn/ui primitives** | `web/src/components/ui/` | MIT-licensed React components |

**No private data sent to third parties.** Audio leaves the device for two reasons only: (a) the reference clone goes to ElevenLabs once, and (b) the target attempt goes to HuggingFace for MDD. We never persist either server-side.

We make no medical claims, no learning-outcome guarantees, no grading guarantees. The product is a diagnostic visualization, not a certified teacher.

### Known limitations (honest)

- **ElevenLabs key is optional in this build.** When unset, `/api/clone` and `/api/synth` return a `demo-fallback` placeholder and the frontend falls back to a pre-rendered MP3 in `web/public/demo-audio/` (curated per sentence). The wow moment of "your own voice" only fires when the key is configured.
- **L1 detection is scripted**, not learned. See *The L1 Cheat* above. The phoneme **trigger** is real (browser ASR-derived); the **L1 label** on the card is scripted.
- **Speech recognition needs Chrome / Edge / Safari.** Firefox lacks Web Speech API; that browser drops to the scripted trigger.
- **MediaPipe Face Mesh wiring is partial.** The mirror stage renders a static target lip silhouette and a timed alignment indicator instead of a live 468-landmark mesh. We document this rather than overclaim.
- **No persistence.** Attempts live in memory for the duration of the tab — there's no account, no history, no telemetry.

### Failure modes

| Failure | Mitigation |
|---|---|
| HF endpoint slow / down | Fallback diagnosis triggers via JSON table; UI never freezes. |
| ElevenLabs latency > 6 s | Pre-rendered fallback audio per sentence (planned in `/public/demo-audio/`). |
| ElevenLabs voice clone leaks accent | Reference Audio Trap fix — clone only from L1 reference. |
| Webcam denied | Mirror step is skippable; UI continues to RESOLVED. |
| All APIs down | Demo loop still walks IDLE → DIAGNOSIS → GOLDEN (fallback) → MIRROR (skip) → RESOLVED. |

---

## Project structure

```
sheganai/
├── api/                  # Vercel Python serverless
│   ├── mdd.py           # POST /api/mdd     — HF wav2vec2 proxy
│   ├── clone.py         # POST /api/clone   — ElevenLabs IVC
│   ├── synth.py         # POST /api/synth   — ElevenLabs TTS
│   ├── health.py        # POST /api/health  — capability probe
│   ├── _utils.py        # CORS + multipart parser shared
│   └── requirements.txt
├── web/                  # Vite + React + Tailwind
│   ├── src/
│   │   ├── App.tsx              # Single-page state machine
│   │   ├── components/
│   │   │   ├── DiagnosisCard.tsx   # The unforgettable hero card
│   │   │   ├── Header.tsx          # SHENG wordmark + stage pill
│   │   │   ├── LanguageToggle.tsx  # RU / UZ — the L1 cheat input
│   │   │   ├── SentencePrompt.tsx  # Hanzi + pinyin centerpiece
│   │   │   ├── Waveform.tsx        # Canvas bar waveform
│   │   │   ├── stages/             # IDLE / RECORDING / ANALYZING / …
│   │   │   └── ui/                 # button, badge, card
│   │   ├── hooks/
│   │   │   └── useRecorder.ts      # Mic + live RMS waveform
│   │   ├── lib/
│   │   │   ├── audio.ts            # WAV encoder + Recorder
│   │   │   ├── api.ts              # Typed serverless client
│   │   │   ├── demoData.ts         # Demo sentences + L1 JSON
│   │   │   └── utils.ts
│   │   └── store/
│   │       └── session.ts          # Zustand state machine
│   └── package.json
├── vercel.json
├── .env.example
├── LICENSE                        # MIT
└── README.md                      # you are here
```

---

## License

MIT — see `LICENSE`.

Built in Tashkent · Hackathon 2026.
