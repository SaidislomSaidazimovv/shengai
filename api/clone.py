"""
POST /api/clone — ElevenLabs Instant Voice Cloning proxy.

Takes a reference recording (the user reading in their L1) and submits it
to ElevenLabs' Instant Voice Cloning endpoint. Returns a voice_id we can
then use against /api/synth.

We never expose the ElevenLabs API key to the browser.
"""
from __future__ import annotations

import os
from typing import Any

import requests

from _utils import make_multipart_handler

EL_KEY = os.environ.get("ELEVENLABS_API_KEY", "").strip()
EL_BASE = os.environ.get("ELEVENLABS_BASE", "https://api.elevenlabs.io")


def post(fields: dict[str, Any]) -> dict[str, Any]:
    audio = fields.get("audio")
    label_raw = fields.get("label", "ovoz-reference")
    if not isinstance(audio, dict):
        raise ValueError("audio file is required")
    label = label_raw if isinstance(label_raw, str) and label_raw else "ovoz-reference"

    if not EL_KEY:
        return {"voiceId": "demo-fallback", "source": "fallback", "reason": "no_elevenlabs_key"}

    try:
        files = {"files": (audio.get("filename", "reference.wav"), audio["data"], audio.get("content_type", "audio/wav"))}
        data = {
            "name": label,
            "description": "OVOZ instant clone (L1 reference)",
            "remove_background_noise": "true",
        }
        res = requests.post(
            f"{EL_BASE}/v1/voices/add",
            headers={"xi-api-key": EL_KEY, "accept": "application/json"},
            files=files,
            data=data,
            timeout=20,
        )
        if res.status_code not in (200, 201):
            return {
                "voiceId": "demo-fallback",
                "source": "fallback",
                "reason": f"elevenlabs_{res.status_code}",
                "detail": res.text[:200],
            }
        payload = res.json()
        voice_id = payload.get("voice_id") or payload.get("voiceId")
        if not voice_id:
            return {"voiceId": "demo-fallback", "source": "fallback", "reason": "no_voice_id"}
        return {"voiceId": voice_id, "source": "elevenlabs"}
    except Exception as exc:  # noqa: BLE001
        return {
            "voiceId": "demo-fallback",
            "source": "fallback",
            "reason": f"exception:{exc.__class__.__name__}",
        }


handler = make_multipart_handler(post)
