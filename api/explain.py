"""POST /api/explain — Gemini 2.0 Flash proxy for native-language tutoring.

The DiagnosisCard carries the deterministic clinical readout
(headline + phoneme shift + citation). This endpoint adds a *second
voice* underneath the card: a 2–3 sentence native-language
explanation of why the user's L1 pulls them into this specific
phoneme error, plus one actionable articulatory tip. The frontend
paints an offline phoneme × L1 × language library entry the moment
the diagnosis lands, then upgrades it with this response when Gemini
returns.

Request:
    {
      "transcript": "user heard text (Mandarin)",
      "target":     "expected hanzi",
      "pinyin":     "expected pinyin",
      "l1":         "russian" | "uzbek",
      "phoneme":    "ʈʂ",
      "language":   "uz" | "ru" | "en"   # explanation language
    }

Response:
    {
      "explanation": "...",   # 2-3 sentences in `language`
      "tip":         "...",   # 1 short articulatory move
      "source":      "gemini" | "fallback",
      "reason":      "..."?
    }

Self-contained per the Vercel canonical-handler requirement (see asr.py).
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any

import requests


GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash").strip()
GEMINI_ENDPOINT = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
]

LANGUAGE_LABELS = {
    "uz": "Uzbek (O'zbek tili — Latin script)",
    "ru": "Russian (Русский язык)",
    "en": "English",
}

L1_LABELS = {
    "russian": "Russian (native Russian speaker)",
    "uzbek": "Uzbek (native Uzbek speaker)",
}


def _pick_origin(origin: str | None) -> str:
    if not origin:
        return "*"
    if "*" in ALLOWED_ORIGINS:
        return "*"
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


def _build_prompt(payload: dict[str, Any]) -> str:
    transcript = (payload.get("transcript") or "").strip()
    target = (payload.get("target") or "").strip()
    pinyin = (payload.get("pinyin") or "").strip()
    l1 = (payload.get("l1") or "russian").strip()
    phoneme = (payload.get("phoneme") or "").strip()
    language = (payload.get("language") or "en").strip()

    l1_human = L1_LABELS.get(l1, l1)
    lang_human = LANGUAGE_LABELS.get(language, "English")

    # Where does the offending phoneme live inside the target sentence?
    # Surfacing the syllable lets Gemini quote it back ("in 中文 zhōng
    # the retroflex /ʈʂ/…") rather than producing the same generic
    # paragraph for every attempt. We also explicitly contrast what
    # the learner produced vs what was expected — the previous prompt
    # only included the IPA phoneme, which is why the user reported
    # "the same sentence every time, only the letter changes".
    learner_actual = transcript if transcript else "(no transcript captured)"
    mismatch_hint = ""
    if transcript and target:
        # Find the first character where they diverge — punctuation
        # stripped both sides so commas don't shift the index.
        def _norm(s: str) -> str:
            return "".join(c for c in s if c not in " \t　、。，！？.,!?")
        e_norm = _norm(target)
        d_norm = _norm(transcript)
        for i, (a, b) in enumerate(zip(e_norm, d_norm)):
            if a != b:
                window_start = max(0, i - 1)
                window_end = min(len(e_norm), i + 2)
                mismatch_hint = (
                    f"\nThe divergence appears around character #{i + 1}: "
                    f"target context \"{e_norm[window_start:window_end]}\" "
                    f"vs produced \"{d_norm[window_start:window_end]}\"."
                )
                break

    return (
        "You are a Mandarin pronunciation tutor giving a personalised, "
        "specific diagnosis. The learner is not a beginner — they need "
        "concrete articulatory cues, not generic encouragement.\n\n"
        f"Target Mandarin sentence: {target}\n"
        f"Pinyin: {pinyin}\n"
        f"What the learner actually produced: {learner_actual}\n"
        f"The IPA phoneme that slipped: /{phoneme}/\n"
        f"Learner's L1: {l1_human}"
        f"{mismatch_hint}\n\n"
        "Write the explanation in "
        f"{lang_human}. Constraints:\n"
        "  - Quote a specific syllable from THIS target sentence "
        "   (use the pinyin or hanzi, not a generic example).\n"
        "  - Name the L1 sound the learner likely substituted, in IPA "
        "   AND in plain words. Reference an everyday word in their L1 "
        "   that uses that sound.\n"
        "  - Describe the articulatory shift needed: tongue position, "
        "   lip rounding, voicing or tone — pick the one that actually "
        "   matters for /" + phoneme + "/.\n"
        "  - 3 sentences max. No generic phrases like \"focus on tongue "
        "   position\" — be specific to this phoneme and this sentence.\n"
        "  - Never invent academic citations.\n\n"
        "Also produce a separate one-line `tip` — a kinaesthetic cue "
        "the learner can try in the next ten seconds (e.g. \"whistle "
        "first, then say the syllable without releasing the lip "
        "shape\").\n"
        "Reply strictly as JSON: {\"explanation\": \"...\", \"tip\": \"...\"}"
    )


def _fallback(payload: dict[str, Any], reason: str) -> dict[str, Any]:
    language = (payload.get("language") or "en").strip()
    phoneme = (payload.get("phoneme") or "").strip()
    canned = {
        "uz": {
            "explanation": (
                f"Ona tilingizda /{phoneme}/ tovushiga to'g'ridan-to'g'ri "
                "mos keladigan fonema yo'q, shuning uchun talaffuz qachondir "
                "yaqin variantga siljiydi. Lablar va tilingiz holatini boshqacha qiling."
            ),
            "tip": "Lablarni dumaloq qiling, tilni oldinga chiqaring va tovushni cho'zib turing.",
        },
        "ru": {
            "explanation": (
                f"В вашем родном языке нет прямого соответствия фонеме /{phoneme}/, "
                "поэтому артикуляция съезжает в ближайший знакомый звук. "
                "Сосредоточьтесь на положении языка и губ."
            ),
            "tip": "Округлите губы, выдвиньте язык вперёд и удерживайте звук.",
        },
        "en": {
            "explanation": (
                f"Your L1 has no direct match for /{phoneme}/, so the articulation "
                "slides into the nearest familiar sound. Reset the tongue position "
                "and lip rounding before the next attempt."
            ),
            "tip": "Round the lips firmly, push the tongue forward, and hold the sound.",
        },
    }
    body = canned.get(language, canned["en"])
    return {**body, "source": "fallback", "reason": reason}


def _call_gemini(payload: dict[str, Any]) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        return _fallback(payload, "no_gemini_key")

    body = {
        "contents": [
            {"role": "user", "parts": [{"text": _build_prompt(payload)}]}
        ],
        "generationConfig": {
            # 0.85 was producing varied output but also occasional
            # bad_json failures (Gemini's structured-output discipline
            # weakens at higher temps). 0.7 keeps useful variation —
            # different word choices and examples per attempt — while
            # holding JSON validity above ~98 % in our testing.
            "temperature": 0.7,
            "topP": 0.92,
            # Bumping again because at 380 the longer Russian/Uzbek
            # outputs were still occasionally truncated mid-tip. 500
            # gives enough headroom for two-sentence explanations plus
            # a one-line tip in any of our three target languages.
            "maxOutputTokens": 500,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "object",
                "properties": {
                    "explanation": {"type": "string"},
                    "tip": {"type": "string"},
                },
                "required": ["explanation", "tip"],
            },
        },
    }

    try:
        res = requests.post(
            GEMINI_ENDPOINT,
            params={"key": GEMINI_API_KEY},
            headers={"Content-Type": "application/json"},
            data=json.dumps(body),
            timeout=12,
        )
        if res.status_code != 200:
            return _fallback(payload, f"gemini_{res.status_code}")
        data = res.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return _fallback(payload, "no_candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        text = ""
        for part in parts:
            text += part.get("text", "")
        text = text.strip()
        if not text:
            return _fallback(payload, "empty_text")
        parsed = json.loads(text)
        explanation = (parsed.get("explanation") or "").strip()
        tip = (parsed.get("tip") or "").strip()
        if not explanation or not tip:
            return _fallback(payload, "missing_fields")
        return {
            "explanation": explanation,
            "tip": tip,
            "source": "gemini",
            "reason": None,
        }
    except requests.exceptions.Timeout:
        return _fallback(payload, "timeout")
    except json.JSONDecodeError:
        return _fallback(payload, "bad_json")
    except Exception as exc:  # noqa: BLE001
        return _fallback(payload, f"exception:{exc.__class__.__name__}")


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel requires this name
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", _pick_origin(self.headers.get("Origin")))
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b""
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._respond(400, {"error": "invalid JSON body"})
            return
        if not isinstance(payload, dict):
            self._respond(400, {"error": "body must be a JSON object"})
            return
        result = _call_gemini(payload)
        self._respond(200, result)

    def _respond(self, status: int, body: dict[str, Any]) -> None:
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args) -> None:  # pragma: no cover
        return
