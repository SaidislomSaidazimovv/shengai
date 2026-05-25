"""POST /api/clone — ElevenLabs Instant Voice Cloning proxy.

Takes a reference recording (the user reading in their L1) and submits
it to ElevenLabs' Instant Voice Cloning endpoint. Returns a voice_id
the frontend stores and reuses for /api/synth.

The ElevenLabs API key never leaves the server.
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


def _pick_origin(origin: str | None) -> str:
    if not origin:
        return "*"
    if "*" in ALLOWED_ORIGINS:
        return "*"
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


def _extract(disposition: str, key: str) -> str | None:
    idx = disposition.find(key)
    if idx < 0:
        return None
    rest = disposition[idx + len(key):]
    if rest.startswith('"'):
        end = rest.find('"', 1)
        return rest[1:end] if end > 0 else None
    end = rest.find(";")
    return rest[:end] if end > 0 else rest


def _parse_multipart(body: bytes, content_type: str) -> dict[str, Any]:
    if not content_type.startswith("multipart/form-data"):
        return {}
    marker = "boundary="
    idx = content_type.find(marker)
    if idx < 0:
        return {}
    boundary = content_type[idx + len(marker):].strip().strip('"')
    delimiter = b"--" + boundary.encode()
    parts = body.split(delimiter)
    result: dict[str, Any] = {}
    for part in parts:
        if not part or part.strip() in (b"", b"--", b"--\r\n"):
            continue
        if part.startswith(b"\r\n"):
            part = part[2:]
        if part.endswith(b"\r\n"):
            part = part[:-2]
        try:
            header_end = part.index(b"\r\n\r\n")
        except ValueError:
            continue
        raw_headers = part[:header_end].decode("utf-8", errors="ignore")
        data = part[header_end + 4:]
        headers: dict[str, str] = {}
        for line in raw_headers.split("\r\n"):
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        disposition = headers.get("content-disposition", "")
        name = _extract(disposition, "name=")
        filename = _extract(disposition, "filename=")
        if not name:
            continue
        if filename:
            result[name] = {
                "filename": filename,
                "data": data,
                "content_type": headers.get("content-type", "application/octet-stream"),
            }
        else:
            result[name] = data.decode("utf-8", errors="replace")
    return result


def _call_elevenlabs(audio: dict[str, Any], label: str) -> dict[str, Any]:
    if not EL_KEY:
        return {"voiceId": "demo-fallback", "source": "fallback", "reason": "no_elevenlabs_key"}
    try:
        # Trust the multipart Content-Type — MediaRecorder produces WebM
        # on Chrome/Firefox, MP4 on Safari, WAV from the prerender script.
        # ElevenLabs IVC accepts all of these; what trips it up is the
        # filename/extension claiming a format the bytes don't match.
        # The frontend now sends filenames whose extension matches the
        # content-type, but we also defend here in case an older client
        # is in flight.
        content_type = audio.get("content_type", "audio/webm")
        filename = audio.get("filename", "reference.webm")
        if filename == "reference.wav" and "webm" in content_type:
            filename = "reference.webm"
        files = {
            "files": (filename, audio["data"], content_type),
        }
        data = {
            "name": label,
            "description": "Mirror instant clone (L1 reference)",
            # Background-noise removal is an extra ~3-5s on ElevenLabs's
            # side. We capture in a quiet demo room with the browser's
            # AGC on and noiseSuppression off — the source is clean
            # enough that turning the cleanup off cuts IVC latency
            # without a noticeable quality hit. Flip this back to "true"
            # if the live environment is loud.
            "remove_background_noise": "false",
        }
        res = requests.post(
            f"{EL_BASE}/v1/voices/add",
            headers={"xi-api-key": EL_KEY, "accept": "application/json"},
            files=files,
            data=data,
            # Frontend's wrapping timeout is 45s — we leave ~10s for
            # proxy + network overhead so the server response always
            # lands first. ElevenLabs IVC measured at 18-28s during
            # peak load + the older 25s budget was getting hit.
            timeout=35,
        )
        if res.status_code not in (200, 201):
            return {
                "voiceId": "demo-fallback",
                "source": "fallback",
                "reason": f"elevenlabs_{res.status_code}",
                "detail": res.text[:400],
            }
        payload = res.json()
        voice_id = payload.get("voice_id") or payload.get("voiceId")
        if not voice_id:
            return {"voiceId": "demo-fallback", "source": "fallback", "reason": "no_voice_id"}
        return {"voiceId": voice_id, "source": "elevenlabs"}
    except requests.Timeout:
        return {
            "voiceId": "demo-fallback",
            "source": "fallback",
            "reason": "elevenlabs_timeout",
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "voiceId": "demo-fallback",
            "source": "fallback",
            "reason": f"exception:{exc.__class__.__name__}",
            "detail": str(exc)[:200],
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
        raw = self.rfile.read(length) if length > 0 else b""
        ctype = self.headers.get("Content-Type", "")

        fields = _parse_multipart(raw, ctype)
        audio = fields.get("audio")
        label_raw = fields.get("label", "mirror-reference")
        if not isinstance(audio, dict):
            self._respond(400, {"error": "audio file is required"})
            return
        label = label_raw if isinstance(label_raw, str) and label_raw else "mirror-reference"

        self._respond(200, _call_elevenlabs(audio, label))

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
