"""
POST /api/score

Scores a user's pitch contour against a canonical native reference for the
intended Mandarin tone. The frontend extracts the contour client-side
(Pitchy/YIN) so we receive a small JSON payload, not a raw audio file —
this keeps us comfortably inside Vercel's serverless limits.

Request:
{
  "pinyin": "hǎo",
  "intendedTone": 3,
  "contour": [{ "t": 0.05, "hz": 0.61 }, { "t": 0.10, "hz": null }, ...]
}

Response:
{
  "toneScore": 87.2,
  "initialScore": 78.0,
  "finalScore": 82.5,
  "overall": 83.7,
  "detectedTone": 3,
  "reference": [0.55, 0.48, ...]
}
"""
from __future__ import annotations

from typing import Any

from _utils import make_handler, score_tone


def _coerce_contour(raw: Any) -> list[float | None]:
    if not isinstance(raw, list):
        raise ValueError("contour must be an array")
    out: list[float | None] = []
    for point in raw:
        if not isinstance(point, dict):
            raise ValueError("contour points must be objects")
        hz = point.get("hz")
        if hz is None:
            out.append(None)
        else:
            out.append(float(hz))
    return out


def post(body: dict[str, Any]) -> dict[str, Any]:
    pinyin = str(body.get("pinyin", ""))
    intended = int(body.get("intendedTone", 1))
    contour = _coerce_contour(body.get("contour", []))

    if not pinyin:
        raise ValueError("pinyin is required")
    if intended not in (1, 2, 3, 4, 5):
        raise ValueError("intendedTone must be 1..5")

    tone_score, detected, reference = score_tone(contour, intended)

    # Lightweight initial/final approximation. With a real phoneme classifier
    # we'd plug it in here; for the hackathon we derive a defensible heuristic
    # from voicing density and how well the user's contour matches the
    # *shape* of the reference vs. the wrong tones.
    voiced = [p for p in contour if p is not None]
    voiced_ratio = len(voiced) / max(len(contour), 1)
    contour_range = (max(voiced) - min(voiced)) if voiced else 0.0

    initial = float(max(35.0, min(99.0, 55.0 + voiced_ratio * 35.0 + (contour_range - 0.4) * 25.0)))
    final = float(max(35.0, min(99.0, 50.0 + 0.4 * tone_score + voiced_ratio * 15.0)))
    overall = float(round(tone_score * 0.5 + initial * 0.25 + final * 0.25, 2))

    return {
        "toneScore": round(tone_score, 2),
        "initialScore": round(initial, 2),
        "finalScore": round(final, 2),
        "overall": overall,
        "detectedTone": detected,
        "reference": [round(v, 4) for v in reference],
    }


handler = make_handler(post)
