"""
POST /api/synth — ElevenLabs text-to-speech proxy.

Generates the "golden voice" — the user's cloned voice saying the
Mandarin demo sentence correctly. We use the Flash v2.5 model for
sub-75ms generation per the handover.
"""
from __future__ import annotations

import base64
import os
from typing import Any

import requests

from _utils import make_json_handler

EL_KEY = os.environ.get("ELEVENLABS_API_KEY", "").strip()
EL_BASE = os.environ.get("ELEVENLABS_BASE", "https://api.elevenlabs.io")
EL_MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_flash_v2_5")


def post(body: dict[str, Any]) -> dict[str, Any]:
    voice_id = body.get("voiceId")
    text = body.get("text")
    if not isinstance(voice_id, str) or not voice_id:
        raise ValueError("voiceId is required")
    if not isinstance(text, str) or not text:
        raise ValueError("text is required")

    if not EL_KEY or voice_id == "demo-fallback":
        return {"audioBase64": "", "source": "prerendered", "reason": "no_key_or_fallback"}

    try:
        res = requests.post(
            f"{EL_BASE}/v1/text-to-speech/{voice_id}",
            headers={
                "xi-api-key": EL_KEY,
                "accept": "audio/mpeg",
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": EL_MODEL,
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.85,
                    "style": 0.2,
                    "use_speaker_boost": True,
                },
            },
            timeout=15,
        )
        if res.status_code != 200:
            return {
                "audioBase64": "",
                "source": "prerendered",
                "reason": f"elevenlabs_{res.status_code}",
            }
        return {
            "audioBase64": base64.b64encode(res.content).decode("ascii"),
            "source": "elevenlabs",
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "audioBase64": "",
            "source": "prerendered",
            "reason": f"exception:{exc.__class__.__name__}",
        }


handler = make_json_handler(post)
