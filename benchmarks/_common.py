"""Shared helpers for Lumina benchmark scripts.

Keeps the individual benchmark scripts focused on their scenario by centralizing
server health checks, authentication, project resolution, timing and synthetic
data generation.
"""

from __future__ import annotations

import math
import os
import random
import time
import urllib.error
import urllib.request
from typing import Any, Optional

import lumina
from lumina.backend.client import LuminaClient

API_URL = os.getenv("LUMINA_API_URL", "http://localhost:8000")
os.environ.setdefault("LUMINA_API_URL", API_URL)


def check_server(raise_on_fail: bool = True) -> bool:
    """Return True if the Lumina backend is reachable at ``/healthz``."""
    try:
        with urllib.request.urlopen(f"{API_URL}/healthz", timeout=5) as resp:
            ok = resp.status == 200
    except (urllib.error.URLError, OSError) as exc:
        if raise_on_fail:
            raise SystemExit(
                f"Cannot reach Lumina server at {API_URL} (/healthz): {exc}\n"
                "Start it first, e.g. `docker compose up`."
            )
        return False
    return ok


def ensure_auth(prefix: str = "bench") -> Optional[str]:
    """Best-effort: create a throwaway user and log in so authenticated
    endpoints work. Returns the API key, or None if the server does not
    require / support sign-up (benchmarks continue unauthenticated)."""
    try:
        client = LuminaClient()
        email = f"{prefix}{int(time.time())}@lumina.ai"
        user = client.create_user(email, name=f"{prefix} user")
        api_key = user["apiKey"]
        lumina.login(api_key)
        return api_key
    except Exception as exc:  # noqa: BLE001 — auth is optional for benchmarks
        print(f"(auth skipped: {exc})")
        return None


def resolve_project(name: str) -> str:
    """Return the project id for ``name``, creating the project if needed."""
    client = LuminaClient()
    project = client.get_project_by_name(name)
    if not project:
        project = client._request("POST", "/api/v1/projects", {"name": name})
    return project["id"]


class Timer:
    """Context manager measuring wall-clock seconds via ``perf_counter``.

    Usage:
        with Timer() as t:
            work()
        print(t.elapsed)  # seconds
    """

    def __init__(self) -> None:
        self.elapsed = 0.0

    def __enter__(self) -> "Timer":
        self._start = time.perf_counter()
        return self

    def __exit__(self, *exc: Any) -> None:
        self.elapsed = time.perf_counter() - self._start


def percentile(values: list[float], p: float) -> float:
    """Linear-interpolation percentile (p in [0, 100])."""
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * (p / 100.0)
    lo = math.floor(k)
    hi = math.ceil(k)
    if lo == hi:
        return ordered[int(k)]
    return ordered[lo] * (hi - k) + ordered[hi] * (k - lo)


def loss_curve(steps: int, start: float = 2.0, floor: float = 0.05, noise: float = 0.02) -> list[float]:
    """Generate a decaying, slightly noisy loss curve of length ``steps``."""
    out = []
    for i in range(steps):
        base = floor + (start - floor) * math.exp(-3.0 * i / max(steps - 1, 1))
        out.append(round(max(floor, base + random.uniform(-noise, noise)), 5))
    return out


def synthetic_image(height: int = 32, width: int = 32):
    """Return an (H, W, 3) uint8 NumPy array, or None if numpy is unavailable."""
    try:
        import numpy as np
    except ImportError:
        return None
    return (np.random.rand(height, width, 3) * 255).astype("uint8")


__all__ = [
    "API_URL",
    "check_server",
    "ensure_auth",
    "resolve_project",
    "Timer",
    "percentile",
    "loss_curve",
    "synthetic_image",
]
