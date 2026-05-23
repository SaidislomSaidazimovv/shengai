"""
POST /api/asr — HuggingFace Whisper Large V3 fallback for Mandarin ASR.

The frontend prefers the browser's Web Speech API (Chrome/Edge/Safari)
because it returns in ~500ms with no cold start. This endpoint is the
fallback for Firefox or when the browser engine errors out — it forwards
the user's recorded audio to `openai/whisper-large-v3` and returns the
Mandarin transcript.

Response shape mirrors what the browser ASR returns so the client can
swap providers transparently:

    { "transcript": "...", "source": "huggingface" | "fallback", "reason"?: "..." }
"""
from __future__ import annotations

import os
from typing import Any

import requests

from _utils import make_multipart_handler

HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()
HF_ASR_ENDPOINT = os.environ.get(
    "HF_ASR_ENDPOINT",
    "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
)


def post(fields: dict[str, Any]) -> dict[str, Any]:
    audio = fields.get("audio")
    if not isinstance(audio, dict):
        raise ValueError("audio file is required")

    if not HF_TOKEN:
        return {
            "transcript": "",
            "source": "fallback",
            "reason": "no_hf_token",
        }

    # Whisper accepts the audio bytes directly. The Content-Type header
    # nudges HF's ffmpeg decoder toward the right container; if the
    # MediaRecorder produced opus/webm we forward that mime; otherwise
    # fall back to a generic audio type.
    content_type = audio.get("content_type") or "audio/webm"

    try:
        res = requests.post(
            HF_ASR_ENDPOINT,
            headers={
                "Authorization": f"Bearer {HF_TOKEN}",
                "Content-Type": content_type,
            },
            data=audio["data"],
            # The free tier may need to load the model on first call —
            # give it room. The client times out at a shorter window so
            # the UI never freezes that long.
            timeout=45,
            params={
                # Whisper's `language` hint shortcuts language detection
                # and is required to get Mandarin output instead of
                # English transliteration.
                "language": "zh",
                "task": "transcribe",
                # `return_timestamps=false` keeps the response tiny.
                "return_timestamps": "false",
            },
        )
        if res.status_code == 503:
            # HF returns 503 with an "estimated_time" header during cold
            # start. We surface that distinctly so the client can stop
            # waiting and use whatever signal it has.
            return {
                "transcript": "",
                "source": "fallback",
                "reason": "model_cold_start",
                "detail": res.text[:200],
            }
        if res.status_code != 200:
            return {
                "transcript": "",
                "source": "fallback",
                "reason": f"hf_{res.status_code}",
                "detail": res.text[:200],
            }

        data = res.json()
        # Whisper inference returns `{ "text": "..." }` for the simple form.
        transcript = ""
        if isinstance(data, dict):
            transcript = (data.get("text") or "").strip()
        elif isinstance(data, str):
            transcript = data.strip()
        elif isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, dict):
                transcript = (first.get("text") or first.get("generated_text") or "").strip()

        return {
            "transcript": transcript,
            "source": "huggingface" if transcript else "fallback",
            "reason": None if transcript else "empty_transcript",
        }
    except requests.exceptions.Timeout:
        return {"transcript": "", "source": "fallback", "reason": "timeout"}
    except Exception as exc:  # noqa: BLE001
        return {
            "transcript": "",
            "source": "fallback",
            "reason": f"exception:{exc.__class__.__name__}",
        }


handler = make_multipart_handler(post)
