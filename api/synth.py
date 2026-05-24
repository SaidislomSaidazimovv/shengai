"""POST /api/synth — ElevenLabs text-to-speech proxy.

Generates the "golden voice" — the user's cloned voice saying the
Mandarin demo sentence correctly. Uses Flash v2.5 for sub-75ms
generation per the dev handover.

Returns the audio as a base64 string so the frontend can drop it into
an <audio src="data:..."> without a second round-trip.
"""
from __future__ import annotations

import base64
import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any

import requests


EL_KEY = os.environ.get("ELEVENLABS_API_KEY", "").strip()
EL_BASE = os.environ.get("ELEVENLABS_BASE", "https://api.elevenlabs.io")
EL_MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_flash_v2_5")
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
]


def _pick_origin(origin: str | None) -> str:
    if not origin:
        return "*"
    if "*" in ALLOWED_ORIGINS:
        return "*"
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


def _call_elevenlabs(voice_id: str, text: str) -> dict[str, Any]:
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
                # Per Mirror DevHandover v02 §14.2:
                # "stability 0.55, similarity 0.85, style 0.0 (let the
                # model render clean Mandarin tones, don't push style)."
                "voice_settings": {
                    "stability": 0.55,
                    "similarity_boost": 0.85,
                    "style": 0.0,
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


class handler(BaseHTTPRequestHandler):  # noqa: N801
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
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except ValueError:
            self._respond(400, {"error": "invalid JSON body"})
            return
        if not isinstance(body, dict):
            self._respond(400, {"error": "body must be a JSON object"})
            return

        voice_id = body.get("voiceId")
        text = body.get("text")
        if not isinstance(voice_id, str) or not voice_id:
            self._respond(400, {"error": "voiceId is required"})
            return
        if not isinstance(text, str) or not text:
            self._respond(400, {"error": "text is required"})
            return

        self._respond(200, _call_elevenlabs(voice_id, text))

    def _respond(self, status: int, body: dict[str, Any]) -> None:
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        encoded = json.dumps(body).encode("utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args) -> None:  # pragma: no cover
        return
