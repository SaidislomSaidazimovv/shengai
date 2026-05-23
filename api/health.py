"""GET /api/health — simple liveness probe used by the frontend status dot."""
from __future__ import annotations

import os
from typing import Any

from _utils import make_handler


def post(body: dict[str, Any]) -> dict[str, Any]:  # noqa: ARG001
    return {
        "ok": True,
        "geminiConfigured": bool(os.environ.get("GEMINI_API_KEY")),
        "model": os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
    }


handler = make_handler(post)
