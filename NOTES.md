# Working notes

Loose notes for our team — context that doesn't belong in the
README/CHANGELOG but should survive a `/compact`. Update freely;
prune what's no longer true.

---

## What the demo actually is

Single-screen, ≤10-second loop in clinical type:

```
IDLE → RECORDING → ANALYZING → DIAGNOSIS → GOLDEN VOICE → MIRROR → RESOLVED
                                    │
                                NO SPEECH (if mic heard nothing)
```

The "honest cheat" per dev handover §5:
- **Real signal:** ASR (Web Speech in Chrome / Whisper in Firefox)
  transcribes the user's Mandarin attempt. We diff against the
  expected hanzi and pin the first mismatching character → its
  phoneme is what we highlight on the analyzing grid.
- **Scripted card:** the `RUSSIAN L1 DETECTED` / `UZBEK L1 DETECTED`
  card text and citation come from `web/src/lib/demoData.ts`. The L1
  label is what the user picked manually.

If the mic heard nothing, we route to `NO SPEECH DETECTED` instead
of fabricating a diagnosis. The NoSpeechStage now also shows a tiny
`engine · …` line with the upstream failure reason, so debugging on
production doesn't need DevTools.

---

## Current AI surface

| Component | Used for | Status |
|---|---|---|
| Browser Web Speech API (`zh-CN`) | Primary ASR on Chrome/Edge/Safari | ✅ Working |
| HuggingFace Whisper Large V3 (`router.huggingface.co/hf-inference/…`) | Fallback ASR on Firefox + `?asr=hf` test path | ✅ Working (after router migration) |
| MediaPipe Face Landmarker (`@mediapipe/tasks-vision`) | Real lip mesh in MirrorStage, 468 landmarks, mouth-openness alignment | ✅ Working |
| ElevenLabs Flash v2.5 + Instant Voice Cloning | Reference clone + golden voice TTS | ❌ Awaiting API key + on-stage user's reference recording |
| Hardcoded L1 diagnosis JSON | Card headline/subhead/detail/citation | ✅ Working (scripted by design) |
| **Gemini 2.0 Flash** | **NOT YET WIRED** — hackathon marks Gemini as **mandatory** (see "Pending decisions") | ❌ |

---

## Pending decisions

### 1. Gemini (mandatory by hackathon rules)

Hackathon "tech stack" slide lists Gemini 2.0 Flash as **Majburiy**.
**Status:** AI Tutor panel **DONE** (commit pending) — explanation
panel under DiagnosisCard with UZ/RU/EN toggle, structured JSON
response, canned fallback per language.

**Files added/changed for AI Tutor:**
- `api/explain.py` (Gemini proxy, canonical handler, fallback per lang)
- `web/src/components/AITutorPanel.tsx`
- `web/src/store/session.ts` (`tutor`, `tutorLoading`, `tutorLanguage`)
- `web/src/lib/api.ts` (`api.explain()`)
- `web/src/components/stages/DiagnosisStage.tsx` (renders panel)
- `web/src/App.tsx` (`requestTutorExplanation`, language toggle handler)
- `api/.env`, `.env.example` (`GEMINI_API_KEY`, `GEMINI_MODEL`)

Vercel env var to add before deploy: `GEMINI_API_KEY` +
`GEMINI_MODEL=gemini-2.0-flash`. Without it, panel labels
"Offline fallback" — visible to judges. Production key MUST be set.

### 1b. Gemini Session Report (DEFERRED — user's idea 2026-05-24)

User proposed extending Gemini from a single panel into the **closing
moment**: track the entire user journey across all stages and surface a
"Session Report" card in RESOLVED with:
- Match % (real signal — char-diff coverage, never invented)
- Strengths (what went right — tones, lip alignment if MediaPipe ran)
- Weaknesses (mispronounced phoneme, attempts taken)
- Next focus (one targeted articulatory cue)
- Encouragement line (native language)

**Why it's good:** Gemini becomes the demo's emotional close. Pitch
arc: *"Gemini explains the error → watches the loop → tells you what
to practice."* Strong EdTech signal.

**Why it's risky:**
- §10 forbids learning-outcome / grading claims. **Mitigation:** label
  the % as "Coverage" or "Match", not "Accuracy" / "Score". Add a
  small `demo readout · not an assessment` disclaimer under the card.
- Mirror alignment may be missing if MediaPipe didn't run — must
  surface as "N/A", **never fabricate** a number.
- Gemini may hallucinate metrics we don't measure (e.g. "tones
  steady" when we don't track tones). Lock the prompt to ONLY the
  fields we actually send; reject hallucinated dimensions.

**Real signals we already have to feed it:**
| Source | Signal |
|---|---|
| `useRecorder` | recording duration (s), live RMS |
| Web Speech / HF Whisper | transcript |
| `findFirstMismatch` | first mismatching char index → char-level diff |
| `phonemeHits` / `triggeredPhoneme` | trigger phoneme |
| `useLipTracker` (MediaPipe) | mouth-openness alignment % per frame |
| `attemptsThisSession` | attempt counter |

**Effort:** ~2 h (new ResolvedStage section, accuracy calc helper,
new `api/explain.py` mode or sibling `api/report.py`, new prompt).

**Decision rule (per user):** ship only AFTER (a) the current AI
Tutor panel is verified live on Vercel and (b) Slides + screenshots
are done. If time runs out, hold for v2 — current Gemini panel alone
satisfies the Majburiy requirement.

### 2. ElevenLabs

Voice cloning + golden voice TTS only fire when the key is
configured. Without it the `Golden Voice` stage falls back to
`/demo-audio/<sentence>.mp3` — and those MP3 files don't exist in
the repo, so audio is silent. Options:
- Buy the Starter plan ($5) and add `ELEVENLABS_API_KEY` to Vercel.
  Real "your own voice" wow moment fires.
- Generate pre-rendered MP3s for the three demo sentences via
  TTSMaker (~15 min) and drop into `web/public/demo-audio/`. Golden
  voice plays, but it's a stock voice, not the user's timbre.
- Skip Golden Voice in the demo flow if neither is ready.

User said: defer voice clone work until the on-stage teammate is
present.

### 3. Brand

Header reads `声 SHENG`. The hackathon stack slide makes Gemini
"majburiy" — and the event title is "Build with **AI**" — so a
brand without "AI" in it is slightly off-narrative. Options:
- Leave as `SHENG`. Most clinical.
- `SHENG.AI` (typography-friendly with the dot).
- `SHENGAI` (the original name on `main`, easy to read).

No decision yet.

### 4. Branch name

Git branch on Vercel deploys is still `ovoz` even though the brand
is now SHENG. We kept it intentionally for deploy continuity (the
README explains this). Worth renaming after the hackathon if SHENG
brand sticks.

---

## Open todo (not in code yet)

- [x] Wire Gemini AI Tutor below DiagnosisCard
- [ ] Add `GEMINI_API_KEY` + `GEMINI_MODEL` to Vercel env, then
  redeploy. Key already in local `api/.env`. Without this the panel
  labels itself "Offline fallback" — visible to judges.
- [ ] **Session Report card in RESOLVED (deferred — see §1b above).**
  User's idea: Gemini reads the full session, surfaces Match % +
  strengths + weaknesses + next focus. Ship only after Tutor is
  verified live and Slides done.
- [ ] Drop pre-rendered MP3s into `web/public/demo-audio/` (or
  configure ElevenLabs)
- [ ] Create the official Google Slides deck (hackathon §6
  requires Slides, not PDF/Canva)
- [ ] Take 5–6 screenshots and a short screen recording as
  backup demo material (per §11)
- [ ] Rehearse the 4-minute pitch with the on-stage teammate
- [ ] Brief a planted Mandarin speaker for the "That's native
  level" amplifier line, if we can find one
- [ ] Decide on USB directional mic + adapter + backup laptop
  (§11 demo-day checklist)

---

## Lessons we paid for (don't lose these)

### `@mediapipe/tasks-vision` IS the modern face_mesh + camera_utils
The Mirror DevHandover v02 §2 stack table names
`@mediapipe/face_mesh + @mediapipe/camera_utils` as the face-tracking
choice. Google deprecated those two packages in 2024 and replaced
them with a single unified package: `@mediapipe/tasks-vision`. It is
what we install. `FaceLandmarker.createFromOptions(...)` returns the
same 468-landmark mesh; webcam handling we do directly via
`getUserMedia`, which is what `camera_utils` wrapped anyway. Rolling
back to the deprecated packages would be a regression — keep
`tasks-vision`. Treat §2 stack item #8 as satisfied via the modern
equivalent.

### HF Inference API moved
The legacy `api-inference.huggingface.co` host was retired in
the 2024-12 Inference Providers migration. Always use
`router.huggingface.co/hf-inference/models/…`. The old host
returns redirects that the `requests` library can't follow on a
POST with a body, surfacing as `ConnectionError`. Same trap for
the next person who tries to use HF Inference from a script.

### Vercel Python detection wants `class handler` at top level
Vercel's static analyser will silently reject a file that builds
its handler via `handler = make_xxx_handler(post)` — "doesn't
match any Serverless Functions inside the api directory". The
canonical
```python
class handler(BaseHTTPRequestHandler):
    def do_POST(self): ...
```
form is what it scans for. Helper modules (`_utils.py`) are fine
but they can't be the place where `handler` is defined. Our four
backend files duplicate a minimal multipart parser and CORS
helper for exactly this reason.

### `outputDirectory` + no `functions` block
When you set `outputDirectory` in `vercel.json` without an
explicit `functions` block, Vercel can treat the project as a
pure static build and skip the `api/` scan entirely. Either keep
the `functions` block (with a maxDuration so it has *something*
to do) or rely on auto-detection — but never set
`outputDirectory` alone and assume Python deploys still happen.

### Two `getUserMedia` calls compete for the mic
We had `Recorder` (in `audio.ts`) calling `getUserMedia` and
`useRecorder` calling it again for the analyser. On some browsers
the second call silently returns a stream that produces only
silence. Always own the stream once at the top of the hook and
fan it out to both the recorder and the analyser nodes.

### MediaPipe Face Landmarker is async to load
The `FaceLandmarker.createFromOptions` call pulls a WASM model
from Google's CDN (~25 MB). First mirror-stage open takes a few
seconds. The `useLipTracker` hook keeps the landmarker reference
warm across mounts so subsequent attempts feel instant.

### "Diagnose" wording is borderline
The hackathon §10 forbids "isbotlanmagan medical / psychological
assessment claims". Our marketing copy uses "diagnose", the UI
mimics a hospital reading, and DiagnosisCard says things like
"RUSSIAN L1 DETECTED". README adds an explicit "no medical /
learning-outcome / grading claims" disclaimer. Worth re-reading
the copy before the pitch to make sure we never cross that line
in the deck.

---

## Local commit not yet pushed

- `6cb344a` — Strip playful hover animations (clinical motion pass).

Pushed up to: `3ce0d6f` (HF router migration).

---

## Hackathon timeline (local notes)

- Started: 2026-05-23 ~16:50 (first git commit `d8476d9`).
- Hard deadline: 2026-05-24 14:30 — team-dashboard upload locks.
- Required at submission: a Google Slides link (template, set to
  "Anyone with the link — Viewer") + the public GitHub repo link.
- Repo: <https://github.com/SaidislomSaidazimovv/shengai>
- Live: <https://sheganai.vercel.app>
