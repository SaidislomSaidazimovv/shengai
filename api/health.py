"""GET /api/health — liveness + capability probe used by the UI."""
from __future__ import annotations

import os
from typing import Any

from _utils import make_json_handler


def post(_body: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": True,
        "elevenlabs": bool(os.environ.get("ELEVENLABS_API_KEY")),
        "hf": bool(os.environ.get("HF_TOKEN")),
        "model": os.environ.get("ELEVENLABS_MODEL", "eleven_flash_v2_5"),
    }


handler = make_json_handler(post)
