"""
Shared helpers for the Vercel serverless endpoints.

Kept dependency-light on purpose:
  - We need to fit inside Vercel's 50 MB Python bundle limit.
  - Heavy ML (e.g. wav2vec2) is intentionally not on this hot path; the
    frontend does the audio capture and pitch extraction, and we receive a
    pre-computed contour as JSON.

The shape of each request/response matches the TypeScript types in
`web/src/lib/api.ts` so the boundary stays honest.
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler
from typing import Any, Callable

import numpy as np


ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]


def _origin_allowed(origin: str | None) -> str:
    """Return the value to put in `Access-Control-Allow-Origin`."""
    if not origin:
        return "*"
    if "*" in ALLOWED_ORIGINS:
        return "*"
    return origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


def make_handler(post_fn: Callable[[dict[str, Any]], dict[str, Any]]) -> type[BaseHTTPRequestHandler]:
    """Wrap a JSON-in / JSON-out function into a Vercel-style handler."""

    class Handler(BaseHTTPRequestHandler):
        def _cors(self) -> None:
            origin = self.headers.get("Origin")
            self.send_header("Access-Control-Allow-Origin", _origin_allowed(origin))
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")

        def do_OPTIONS(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler casing)
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
            except Exception as exc:  # pragma: no cover — defensive
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
            return  # silence default request logger; Vercel captures stdout

    return Handler


# ----- Pitch / tone helpers ----------------------------------------------------


def normalize_voiced(values: list[float | None]) -> np.ndarray:
    """Drop unvoiced frames and return a 1-D float array."""
    arr = np.array([v for v in values if v is not None], dtype=np.float64)
    return arr


def dtw_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Standard DTW with absolute-difference local cost.

    Returns the per-step average cost so the metric is invariant to length.
    """
    if a.size == 0 or b.size == 0:
        return float("inf")
    n, m = a.size, b.size
    cost = np.full((n + 1, m + 1), np.inf, dtype=np.float64)
    cost[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d = abs(a[i - 1] - b[j - 1])
            cost[i, j] = d + min(cost[i - 1, j], cost[i, j - 1], cost[i - 1, j - 1])
    return float(cost[n, m] / max(n, m))


# Canonical reference contours, normalized [0, 1], length 20.
# Mirrors web/src/lib/pitch.ts so client and server produce comparable scores.
def _linspace(a: float, b: float, n: int) -> list[float]:
    if n <= 1:
        return [a]
    step = (b - a) / (n - 1)
    return [a + step * i for i in range(n)]


def _dipping(n: int = 20) -> list[float]:
    import math

    out: list[float] = []
    for i in range(n):
        t = i / max(n - 1, 1)
        v = 0.55 - 0.5 * math.sin(math.pi * t) + 0.4 * t * t
        out.append(max(0.0, min(1.0, v)))
    return out


TONE_REFERENCES: dict[int, list[float]] = {
    1: _linspace(0.85, 0.85, 20),
    2: _linspace(0.35, 0.90, 20),
    3: _dipping(),
    4: _linspace(0.95, 0.15, 20),
    5: _linspace(0.55, 0.45, 20),
}


def score_tone(contour_hz: list[float | None], intended_tone: int) -> tuple[float, int, list[float]]:
    """Return (score 0–100, detected tone, reference contour used)."""
    reference = TONE_REFERENCES.get(int(intended_tone), TONE_REFERENCES[1])
    voiced = normalize_voiced(contour_hz)
    if voiced.size < 4:
        return 0.0, 5, reference

    ref_arr = np.array(reference, dtype=np.float64)
    dist = dtw_distance(voiced, ref_arr)
    score = max(0.0, min(100.0, 100.0 - dist * 110.0))

    # Detect tone from shape — simple slope/range heuristic, mirrors frontend.
    start = float(voiced[: max(2, voiced.size // 6)].mean())
    end = float(voiced[-max(2, voiced.size // 6) :].mean())
    rng = float(voiced.max() - voiced.min())
    slope = end - start
    min_idx = int(np.argmin(voiced))

    if rng < 0.15:
        detected = 1 if start > 0.55 else 5
    elif slope > 0.2:
        detected = 2
    elif slope < -0.2:
        detected = 4
    elif voiced.size * 0.2 < min_idx < voiced.size * 0.85 and voiced[min_idx] < start - 0.1 and voiced[min_idx] < end - 0.1:
        detected = 3
    else:
        detected = 2 if slope >= 0 else 4

    return float(score), int(detected), reference
