"""POST /api/translate — OpenAI GPT-4o-mini proxy for custom-sentence pipeline.

Pipeline:
  1. User types a short sentence in their native language (RU/UZ/EN).
  2. This endpoint sends it to OpenAI GPT-4o-mini with a structured
     JSON request, asking for a Mandarin translation plus phoneme
     analysis and L1-specific diagnoses for both russian and uzbek.
  3. The frontend uses pinyin-pro locally to derive pinyin + per-char
     syllables from the returned hanzi — we deliberately do NOT ask
     the LLM for pinyin, since pinyin-pro is offline, instant, and
     more accurate than token-by-token generation.
  4. The frontend assembles a DemoSentence-shaped object and slots it
     into session.customSentence, after which the normal SPEAK →
     DIAGNOSE → GOLDEN → MIRROR loop runs unchanged.

Request body:
    {
      "text":      "<user text in source language>",
      "sourceL1":  "russian" | "uzbek" | "english"
    }

Response body (on success):
    {
      "hanzi":             "我喜欢学中文",
      "expectedPhonemes":  ["w","ɔ","ɕ","i", ...],
      "charPhonemeIdx":    [0, 2, 4, 7, 10, 13],
      "diagnoses": {
        "russian": { headline, subhead, detail, triggerPhoneme,
                     phonemeShift: {expected, detected},
                     patternNumber, patternTotal, citation },
        "uzbek":   { ... same shape ... }
      },
      "source": "openai"
    }

On error:
    {
      "error": "<reason>",
      "source": "fallback"
    }

The OpenAI key never leaves the server.
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any

import requests


OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()
OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions"
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
]


L1_LABELS = {
    "russian": "Russian (native Russian speaker)",
    "uzbek": "Uzbek (native Uzbek speaker)",
    "english": "English (native English speaker)",
}


def _pick_origin(origin: str | None) -> str:
    if not origin:
        return "*"
    if "*" in ALLOWED_ORIGINS:
        return "*"
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


def _build_prompt(text: str, source_l1: str) -> str:
    source_label = L1_LABELS.get(source_l1, source_l1 or "an unknown language")

    return (
        f"You are a Mandarin pronunciation analysis engine. The user "
        f"is a {source_label} writing a short sentence in their own "
        f"language; translate it to Mandarin and produce a complete "
        f"L1-aware diagnosis for both Russian and Uzbek learners.\n\n"
        f'User input: "{text}"\n\n'
        "Return strictly valid JSON with this exact shape:\n"
        "{\n"
        '  "hanzi": "<the Mandarin translation, no punctuation>",\n'
        '  "expectedPhonemes": ["<IPA1>", "<IPA2>", ...],\n'
        '  "charPhonemeIdx": [<start phoneme index for each hanzi>],\n'
        '  "diagnoses": {\n'
        '    "russian": {\n'
        '      "headline": "RUSSIAN L1 DETECTED",\n'
        '      "subhead": "<5-9 word clinical statement in IPA, e.g. \\"Retroflex /ʈʂ/ palatalised\\">",\n'
        '      "detail": "<2 sentences explaining the L1-transfer error in IPA>",\n'
        '      "triggerPhoneme": "<IPA — must match phonemeShift.expected>",\n'
        '      "phonemeShift": { "expected": "<IPA>", "detected": "<IPA L1 substitute>" },\n'
        '      "patternNumber": 1,\n'
        '      "patternTotal": 1,\n'
        '      "citation": "Live · GPT-4o-mini"\n'
        "    },\n"
        '    "uzbek": { ... same shape ... }\n'
        "  }\n"
        "}\n\n"
        "Constraints:\n"
        "  - Everything in /IPA/. No pinyin, no Cyrillic, no Latin "
        "approximations inside the phoneme fields.\n"
        "  - triggerPhoneme MUST equal phonemeShift.expected for each L1.\n"
        "  - subhead and detail must reference the SAME phoneme as the "
        "phonemeShift box.\n"
        "  - hanzi length must equal charPhonemeIdx length (one start "
        "index per Mandarin character).\n"
        "  - Never invent academic citations. The citation field is "
        "fixed to \"Live · GPT-4o-mini\".\n"
        "  - Pick the L1-specific phoneme that's most likely to trip the "
        "learner in THIS sentence (e.g. /ʈʂ/ for Russian, /y/ for Uzbek).\n"
    )


def _call_openai(text: str, source_l1: str) -> dict[str, Any]:
    if not OPENAI_API_KEY:
        return {"error": "no_openai_key", "source": "fallback"}

    body = {
        "model": OPENAI_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a Mandarin pronunciation analysis engine. "
                    "Respond only in valid JSON matching the exact shape "
                    "the user asks for. Never invent academic citations."
                ),
            },
            {"role": "user", "content": _build_prompt(text, source_l1)},
        ],
        # Lower temperature than the tutor endpoint because the
        # diagnosis fields need to stay consistent with each other
        # (triggerPhoneme == phonemeShift.expected, hanzi length ==
        # charPhonemeIdx length). 0.5 gives just enough flexibility
        # for natural translations.
        "temperature": 0.5,
        "top_p": 0.9,
        # 1200 tokens covers a moderately long sentence with two
        # full L1 diagnoses. Cyrillic/Uzbek output runs ~1.5× longer
        # than English so this leaves comfortable headroom.
        "max_tokens": 1200,
        "response_format": {"type": "json_object"},
    }

    try:
        res = requests.post(
            OPENAI_ENDPOINT,
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            data=json.dumps(body),
            # Translation + diagnosis is a larger task than the tutor
            # call; allow up to 25s for warm requests. Cold-start
            # rarely touches 18s in our testing.
            timeout=25,
        )
        if res.status_code != 200:
            return {
                "error": f"openai_{res.status_code}",
                "source": "fallback",
                "detail": res.text[:300],
            }
        data = res.json()
        choices = data.get("choices") or []
        if not choices:
            return {"error": "no_choices", "source": "fallback"}
        text_out = (choices[0].get("message") or {}).get("content", "").strip()
        if not text_out:
            return {"error": "empty_text", "source": "fallback"}
        parsed = json.loads(text_out)

        # Validate the critical invariants the prompt asks for —
        # bad LLM output should fail loud, not silently propagate
        # to the frontend where it would break the DiagnosisCard.
        hanzi = parsed.get("hanzi") or ""
        phonemes = parsed.get("expectedPhonemes") or []
        idx = parsed.get("charPhonemeIdx") or []
        diagnoses = parsed.get("diagnoses") or {}
        if not isinstance(hanzi, str) or not hanzi:
            return {"error": "missing_hanzi", "source": "fallback"}
        if not isinstance(phonemes, list) or not phonemes:
            return {"error": "missing_phonemes", "source": "fallback"}
        if not isinstance(idx, list) or len(idx) != len(hanzi):
            return {
                "error": "char_phoneme_idx_mismatch",
                "source": "fallback",
                "detail": f"hanzi={len(hanzi)} idx={len(idx)}",
            }
        if not (isinstance(diagnoses, dict) and "russian" in diagnoses and "uzbek" in diagnoses):
            return {"error": "missing_diagnoses", "source": "fallback"}

        return {**parsed, "source": "openai"}
    except requests.exceptions.Timeout:
        return {"error": "openai_timeout", "source": "fallback"}
    except json.JSONDecodeError:
        return {"error": "openai_bad_json", "source": "fallback"}
    except Exception as exc:  # noqa: BLE001
        return {
            "error": f"openai_exception:{exc.__class__.__name__}",
            "source": "fallback",
        }


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

        text = (payload.get("text") or "").strip()
        source_l1 = (payload.get("sourceL1") or "").strip().lower()
        if not text:
            self._respond(400, {"error": "text is required"})
            return
        if len(text) > 500:
            self._respond(400, {"error": "text too long (max 500 chars)"})
            return
        if source_l1 not in L1_LABELS:
            self._respond(400, {"error": "sourceL1 must be russian|uzbek|english"})
            return

        result = _call_openai(text, source_l1)
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
