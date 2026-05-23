"""
Shared helpers for the OVOZ Vercel serverless endpoints.

We keep the surface tiny on purpose: each endpoint is a single Python
file with a `handler` class, and shared bits live here. Heavy lifting
(MDD, voice cloning, TTS) runs on external APIs (HuggingFace,
ElevenLabs) so this layer stays inside Vercel's 50 MB function budget.
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any, Callable


ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]


def _origin_allowed(origin: str | None) -> str:
    if not origin:
        return "*"
    if "*" in ALLOWED_ORIGINS:
        return "*"
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


def make_json_handler(
    post_fn: Callable[[dict[str, Any]], dict[str, Any]],
) -> type[BaseHTTPRequestHandler]:
    """Wrap a JSON-in / JSON-out function as a Vercel-style handler."""

    class Handler(BaseHTTPRequestHandler):
        def _cors(self) -> None:
            origin = self.headers.get("Origin")
            self.send_header("Access-Control-Allow-Origin", _origin_allowed(origin))
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
                if not isinstance(body, dict):
                    raise ValueError("Body must be a JSON object")
                payload = post_fn(body)
                self._respond(200, payload)
            except ValueError as exc:
                self._respond(400, {"error": str(exc)})
            except Exception as exc:  # noqa: BLE001
                self._respond(500, {"error": "internal_error", "detail": str(exc)})

        def do_GET(self) -> None:  # noqa: N802
            self._respond(405, {"error": "method_not_allowed"})

        def _respond(self, status: int, body: dict[str, Any]) -> None:
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", "application/json")
            payload = json.dumps(body).encode("utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_args: Any) -> None:  # pragma: no cover
            return

    return Handler


def parse_multipart(body: bytes, content_type: str) -> dict[str, Any]:
    """Minimal multipart parser — enough for our (file, fields...) requests.

    Returns a dict where file parts are dicts {"filename": str, "data": bytes,
    "content_type": str} and text fields are plain strings.
    """
    if not content_type.startswith("multipart/form-data"):
        return {}
    boundary_marker = "boundary="
    idx = content_type.find(boundary_marker)
    if idx < 0:
        return {}
    boundary = content_type[idx + len(boundary_marker):].strip().strip('"')
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


def make_multipart_handler(
    post_fn: Callable[[dict[str, Any]], dict[str, Any]],
) -> type[BaseHTTPRequestHandler]:
    """Variant of make_json_handler for multipart/form-data POSTs."""

    class Handler(BaseHTTPRequestHandler):
        def _cors(self) -> None:
            origin = self.headers.get("Origin")
            self.send_header("Access-Control-Allow-Origin", _origin_allowed(origin))
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
            try:
                fields = parse_multipart(raw, ctype)
                payload = post_fn(fields)
                self._respond(200, payload)
            except ValueError as exc:
                self._respond(400, {"error": str(exc)})
            except Exception as exc:  # noqa: BLE001
                self._respond(500, {"error": "internal_error", "detail": str(exc)})

        def _respond(self, status: int, body: dict[str, Any]) -> None:
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", "application/json")
            payload = json.dumps(body).encode("utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_args: Any) -> None:  # pragma: no cover
            return

    return Handler
