"""POST /api/clone_delete — release an ElevenLabs voice slot.

The Starter plan caps the workspace at 10 IVC voice slots. Mirror clones
a fresh voice on every Reference Capture, so without this endpoint the
11th visitor would hit a "slot full" error from ElevenLabs and the
"hear your own voice" promise would silently break.

We expose this as POST (rather than DELETE) because the frontend calls
it from navigator.sendBeacon() on tab close — sendBeacon only does POST,
and the call has to survive the page unload. The voice ID arrives as a
JSON body; the ElevenLabs API key never leaves the server.

Body: {"voiceId": "<voice id from /api/clone>"}
Returns: {"ok": true} on success, {"ok": false, "reason": "..."} on
anything else. We never throw — a failed cleanup is best-effort, not a
demo blocker.
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any

import requests


EL_KEY = os.environ.get("ELEVENLABS_API_KEY", "").strip()
EL_BASE = os.environ.get("ELEVENLABS_BASE", "https://api.elevenlabs.io")
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
]

# Never delete the preset demo voice ID — it's the hardcoded Skip-path
# voice in web/src/data/demoUser.ts and must survive across sessions.
PROTECTED_VOICE_IDS = {
    "demo-fallback",
    os.environ.get("DEMO_VOICE_ID", "").strip(),
}


def _pick_origin(origin: str | None) -> str:
    if not origin:
        return "*"
    if "*" in ALLOWED_ORIGINS:
        return "*"
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


def _call_elevenlabs_delete(voice_id: str) -> dict[str, Any]:
    if not EL_KEY:
        return {"ok": False, "reason": "no_elevenlabs_key"}
    try:
        res = requests.delete(
            f"{EL_BASE}/v1/voices/{voice_id}",
            headers={"xi-api-key": EL_KEY, "accept": "application/json"},
            timeout=10,
        )
        if res.status_code in (200, 204):
            return {"ok": True}
        return {
            "ok": False,
            "reason": f"elevenlabs_{res.status_code}",
            "detail": res.text[:200],
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "reason": f"exception:{exc.__class__.__name__}"}


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
        raw = self.rfile.read(length) if length > 0 else b""
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except json.JSONDecodeError:
            self._respond(400, {"ok": False, "reason": "invalid_json"})
            return

        voice_id = payload.get("voiceId") if isinstance(payload, dict) else None
        if not isinstance(voice_id, str) or not voice_id.strip():
            self._respond(400, {"ok": False, "reason": "missing_voice_id"})
            return

        if voice_id in PROTECTED_VOICE_IDS:
            self._respond(200, {"ok": True, "reason": "protected_skipped"})
            return

        self._respond(200, _call_elevenlabs_delete(voice_id))

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
