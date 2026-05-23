# 4-Minute Demo Script

Use this script for the final pitch. It's deliberately written for the
person clicking the mouse, not for the slides.

## Setup (before you're called)

- Open two tabs: `/test` and `/dashboard`.
- Plug in the headset. Volume audible to judges.
- Clear localStorage so the dashboard is empty (proves it builds from
  the demo, not pre-baked data).

## 0:00 – 0:40 — Problem

> "If you've used Duolingo for Mandarin, you've had this experience:
> you pronounce a syllable, the green tick appears, you move on —
> and a native speaker still can't understand you. Mainstream apps
> don't reliably score tones. Specialized tools exist, but each only
> solves a slice of the problem."

Show the comparison table on the landing page. Don't read every row —
point to the **Uzbek / RU / EN tutor** column.

## 0:40 – 2:30 — Live demo

Click **Take the free test**. Speak the first syllable *correctly*:

> "Nǐ. The pitch curve overlay shows my voice in orange, the native
> reference in green. Tone, initial, final each scored separately."

Then **intentionally botch the next one** — say "mā" but with falling
tone instead of high level.

> "Now I'm going to deliberately get the tone wrong. Watch."

When the result appears:

> "Right — it caught me. Tone score dropped, and look at the AI tutor
> below: it's explaining the linguistic cause **in Uzbek**, telling me
> the pitch fell when it should have stayed high."

Toggle the language switcher to Russian or English to show
multilingual feedback.

## 2:30 – 3:20 — Adaptive engine

Click **Dashboard**.

> "Every attempt is logged locally. The 'Mistake heat-map' on the
> right shows which syllables you confuse most — not generic course
> content, but *your* specific weak spots. The Practice page surfaces
> exactly those for drilling."

Open Practice → Recommended tab. Show the same syllables appearing.

## 3:20 – 4:00 — Tech & ask

> "Pitch extraction runs in the browser using the YIN algorithm —
> no audio leaves the device for scoring. Tone refinement is DTW on
> a Vercel Python serverless function. Tutor explanations come from
> Gemini 2.0 Flash with a structured prompt that forbids
> generic encouragement.
>
> If the backend is down, the app still works — three-layer
> graceful degradation. It's deployed at `<your-vercel-URL>` and
> open-sourced under MIT.
>
> We built ShengAI in two days at this hackathon. We'd like to
> continue it as an Uzbekistan-rooted EdTech product."

## Backup plan

If the mic fails on stage:
- Have a 30-second screen recording of the recording-to-result flow on
  the laptop desktop.
- Continue narrating: "I'll show the recording I made earlier this
  morning…"

If Gemini fails on stage:
- The "Offline" badge will appear automatically — point at it:
  "Notice the AI tutor degraded to the template version. Nothing
  blocks the user."
