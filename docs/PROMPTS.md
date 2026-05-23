# Prompts Used in ShengAI

Per Hackathon §10 (Responsible AI), every Gemini prompt used in the
product is versioned and reproduced here. The live source of truth is
`api/explain.py`.

## `/api/explain` — pronunciation tutor

### System prompt (parameterised by target language)

```
You are ShengAI, an expert Mandarin pronunciation coach speaking to a learner.
Your job is to convert numeric pronunciation scores into actionable, friendly,
specific advice. Constraints:
  - Always answer in {language}, never in any other language.
  - 2–3 sentences total. No bullet points. No emoji.
  - Mention the *cause* of the issue (e.g. pitch shape, articulation place),
    not generic encouragement.
  - If tone is wrong, refer to what shape the user produced vs. the target.
  - End with one concrete thing to try next.
  - Never invent scores or claim certainty about the learner's accent.
```

`{language}` is filled with the user's preferred language label —
`Uzbek (latin script)`, `Russian`, or `English`. We pass it through the
Gemini `system_instruction` field, not the user turn, so the model
treats it as binding.

### User prompt template

```
Syllable: {pinyin}
Target tone: {intendedTone} — {tone_description}.
Detected tone: {detectedTone} — {tone_description}.
Tone accuracy score: {toneScore} / 100.
Initial (consonant) score: {initialScore} / 100.
Final (vowel/ending) score: {finalScore} / 100.

Write the feedback now.
```

`tone_description` is mapped from a fixed table:

| Tone | Description |
|---|---|
| 1 | high level (steady, high pitch) |
| 2 | rising (mid to high) |
| 3 | dipping (falls then rises) |
| 4 | falling (sharp high-to-low) |
| 5 | neutral (short, unstressed) |

### Generation config

```
temperature       = 0.5
top_p             = 0.9
max_output_tokens = 220
model             = gemini-2.0-flash (default; override with GEMINI_MODEL env)
```

`temperature` is intentionally moderate: low enough to keep the
linguistic reasoning grounded, high enough that the same syllable gets
different phrasings across attempts.

### Why these constraints

- **"2–3 sentences."** Anything longer crowds the UI on mobile.
- **"Mention the cause."** The interesting innovation vs. Duolingo is
  *explaining the linguistic root*. Without this, Gemini drifts into
  "Great job! Keep practicing!" filler.
- **"Never invent scores."** Gemini will confabulate plausible-looking
  numbers if you let it. We pass the scores, the model is forbidden from
  inventing new ones.
- **`system_instruction` (not in-context).** Putting language and rules
  in `system_instruction` is more durable than prepending them to each
  user turn — the model is less likely to drift mid-conversation.

## What we do NOT send to Gemini

- Raw audio: never. Audio stays in the browser.
- User identifiers: we don't have accounts in the MVP.
- Other learners' data: each request is independent and stateless.

The only personal-ish field is the user's chosen `lang`, which is a
preference, not PII.

## Failure handling

If the Gemini call fails (quota, network, model unavailable, or empty
response), `api/explain.py` returns `source: "fallback"` and a short
template message. The frontend additionally has its own template tutor
in `web/src/lib/feedback.ts` that kicks in if the entire backend is
unreachable. There are therefore three layers of degradation, and the
user always sees usable advice.
