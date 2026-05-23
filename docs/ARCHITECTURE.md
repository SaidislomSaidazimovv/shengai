# Architecture

## One-line summary

A two-tier web app: a Vite + React SPA that captures audio and does
real-time pitch analysis in the browser, plus a thin Vercel-Python
serverless layer that refines the score with DTW and generates
native-language tutor feedback via Gemini.

## Why this shape

We had two real constraints:

1. **Hackathon timeframe.** Anything we couldn't finish, demo, and explain
   in two days had to go. That ruled out training our own phoneme model.
2. **Vercel-first deploy.** Heavy ML on Vercel serverless (>50 MB, cold
   starts) is painful. So we pushed the latency-sensitive work
   (microphone, pitch extraction, visualisation) into the browser where
   it doesn't pay a network round-trip, and kept the serverless layer
   light.

The bonus: when the backend is down, the product still works. Pitch
overlay, scoring, and dashboard all run offline. Only the Gemini-powered
explanation requires the network, and we degrade gracefully to a
template-based tutor when it's unavailable.

## Data flow

```
┌──────────────────────────────────────────────────────────┐
│ Browser                                                  │
│                                                          │
│  Mic ──► Web Audio API ──► PCM Float32 ──► Pitchy (YIN) │
│                                            │             │
│                                            ▼             │
│                                   Normalized contour     │
│                                            │             │
│      ┌─────────────────────────────────────┤             │
│      ▼                                     ▼             │
│  Local scoring  ──────────────►  POST /api/score         │
│  (DTW + heuristics)              (refined DTW)           │
│      │                                     │             │
│      ▼                                     ▼             │
│  Scores  ◄───────────  (server response if reachable)    │
│      │                                                   │
│      ▼                                                   │
│  POST /api/explain  ──►  Gemini 2.0 Flash                │
│      │                                                   │
│      ▼  (or fallback template)                           │
│  Render: pitch overlay, three scores, AI feedback        │
└──────────────────────────────────────────────────────────┘
```

## Components

### Frontend (`web/`)
- **React 19 + Vite** — SPA, no SSR. Vercel deploys the static bundle.
- **Tailwind + shadcn/ui** — visual primitives without committing to a
  heavy design system.
- **Pitchy (YIN)** — fundamental-frequency extraction. The library is
  tiny (<10 KB minified) and runs in `<200 ms` on a 3-second clip.
- **Recharts** — pitch curve overlay. We considered D3 but recharts
  was three times less code for this use case.
- **Zustand + localStorage** — persistent progress without standing up
  auth. Auth was deliberately scoped out; localStorage proves the
  adaptive flow without users having to sign up to demo it.

### Serverless (`api/`)
- **`api/score.py`** — accepts the client's pitch contour, returns a
  refined tone score, detected tone, and the canonical reference
  contour. NumPy DTW only.
- **`api/explain.py`** — wraps Gemini with a structured prompt that
  enforces (a) target language, (b) 2–3 sentences, (c) cause-focused
  feedback. Returns `{ text, source }` where `source` is either
  `"gemini"` or `"fallback"`.
- **`api/health.py`** — liveness probe.
- **`_utils.py`** — `BaseHTTPRequestHandler` adapter + DTW + tone refs.

### Vercel routing
`vercel.json` does two things:
1. Maps any non-`/api/...` request to `web/dist/index.html` (SPA
   fallback for client-side routing).
2. Promotes every `api/*.py` to a Python 3.11 serverless function.

## Failure modes & fallbacks

| What breaks | What the user sees |
|---|---|
| Backend down | Frontend computes scores locally; "Offline" badge on the feedback card; template-based feedback. |
| Gemini quota | `/api/explain` returns `source: "fallback"`; same text from the local template-feedback module. |
| Mic permission denied | Clear error in the recorder with a retry button. No silent failure. |
| Voice too quiet / unvoiced | `voiced=false`, score 0 with a "No voice detected" badge — we don't pretend to have analysed silence. |

## What we deliberately didn't do

- **Phoneme classifier on the server.** wav2vec2-mandarin is 360 MB, too
  big for serverless cold-starts. We document this as future work and
  keep initial/final scores as a transparent heuristic.
- **Auth.** localStorage proves the personalised-drill story without
  signup friction during judging.
- **Pre-recorded native audio.** We use the browser's built-in
  `SpeechSynthesis` for the demo. The actual scoring reference is a
  numeric contour, not a clip, so this doesn't affect correctness.

## File map (selected)

```
web/src/lib/audio.ts          ← microphone, WAV encoding
web/src/lib/pitch.ts          ← YIN wrapper, tone detection, DTW
web/src/lib/scoring.ts        ← client-side score pipeline (used always)
web/src/lib/api.ts            ← typed client w/ timeout + fallback wrapper
web/src/lib/feedback.ts       ← three-language template tutor
web/src/components/PitchCurve.tsx  ← Recharts overlay
web/src/components/Recorder.tsx    ← record / stop / auto-stop UI
api/score.py                  ← refined DTW endpoint
api/explain.py                ← Gemini wrapper + fallback
api/_utils.py                 ← shared handler + DTW + references
```
