"""GET/POST /api/health — liveness + capability probe used by the UI.

Self-contained on purpose: Vercel's serverless function scanner
sometimes refuses to recognise a file when its `handler` is assigned
from a helper module. The canonical `class handler(BaseHTTPRequestHandler)`
form is what Vercel's static analyser keys off, so we keep this file
free of cross-file imports.
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler


_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "*",
    ).split(",")
    if o.strip()
]


def _pick_origin(origin: str | None) -> str:
    if not origin:
        return "*"
    if "*" in _ALLOWED_ORIGINS:
        return "*"
    if origin in _ALLOWED_ORIGINS:
        return origin
    return _ALLOWED_ORIGINS[0] if _ALLOWED_ORIGINS else "*"


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel requires this name
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", _pick_origin(self.headers.get("Origin")))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802 — GET also returns health so judges can poke it from the URL bar.
        self._respond()

    def do_POST(self) -> None:  # noqa: N802
        self._respond()

    def _respond(self) -> None:
        body = json.dumps(
            {
                "ok": True,
                "hf": bool(os.environ.get("HF_TOKEN")),
                "elevenlabs": bool(os.environ.get("ELEVENLABS_API_KEY")),
                "model": os.environ.get("ELEVENLABS_MODEL", "eleven_flash_v2_5"),
                "asrEndpoint": os.environ.get(
                    "HF_ASR_ENDPOINT",
                    "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
                ),
            }
        ).encode("utf-8")
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args) -> None:  # pragma: no cover — silence default logger
        return
