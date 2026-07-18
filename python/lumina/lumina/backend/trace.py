"""Minimal Trace/Span support for the Lumina backend path."""

from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from typing import Any, Optional

from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


@contextmanager
def trace(
    name: str,
    *,
    trace_id: Optional[str] = None,
    project: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
):
    """Context manager that creates and finishes a Lumina trace."""
    ctx = get_run_context()
    project_name = project or ctx.project
    if not project_name:
        raise ValueError("project is required when no run context exists")

    client = LuminaClient()
    project_obj = client.get_project_by_name(project_name)
    if not project_obj:
        project_obj = client._request("POST", "/api/v1/projects", {"name": project_name})
    project_id = project_obj["id"]

    tid = trace_id or str(uuid.uuid4())
    trace_obj = client.create_trace(
        project_id,
        name,
        trace_id=tid,
        run_id=ctx.run_id,
        metadata=metadata,
    )

    previous_trace_id = ctx.__dict__.get("trace_id")
    ctx.trace_id = tid
    start = time.time()
    status = "ok"
    try:
        yield trace_obj
    except Exception:
        status = "error"
        raise
    finally:
        latency_ms = int((time.time() - start) * 1000)
        client.patch_trace(tid, status=status, latency_ms=latency_ms)
        ctx.trace_id = previous_trace_id


@contextmanager
def span(
    name: str,
    *,
    span_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    parent_span_id: Optional[str] = None,
    kind: str = "internal",
    input_data: Optional[dict[str, Any]] = None,
):
    """Context manager that creates and finishes a span within a trace."""
    ctx = get_run_context()
    tid = trace_id or ctx.trace_id
    if not tid:
        raise ValueError("trace_id is required. Use inside a lumina.trace() context or pass trace_id.")

    client = LuminaClient()
    sid = span_id or str(uuid.uuid4())
    span_obj = client.create_span(
        tid,
        name,
        span_id=sid,
        parent_span_id=parent_span_id or ctx.span_id,
        kind=kind,
        input_data=input_data,
    )

    previous_span_id = ctx.__dict__.get("span_id")
    ctx.span_id = sid
    start = time.time()
    status = "ok"
    output_data: dict[str, Any] = {}
    try:
        yield span_obj
    except Exception:
        status = "error"
        raise
    finally:
        latency_ms = int((time.time() - start) * 1000)
        client.patch_span(sid, status=status, output_data=output_data, latency_ms=latency_ms)
        ctx.span_id = previous_span_id


def start_trace(
    name: str,
    *,
    trace_id: Optional[str] = None,
    project: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Manually start a trace (use ``trace()`` context manager preferred)."""
    ctx = get_run_context()
    project_name = project or ctx.project
    if not project_name:
        raise ValueError("project is required when no run context exists")

    client = LuminaClient()
    project_obj = client.get_project_by_name(project_name)
    if not project_obj:
        project_obj = client._request("POST", "/api/v1/projects", {"name": project_name})
    project_id = project_obj["id"]

    tid = trace_id or str(uuid.uuid4())
    trace_obj = client.create_trace(
        project_id,
        name,
        trace_id=tid,
        run_id=ctx.run_id,
        metadata=metadata,
    )
    ctx.trace_id = tid
    return trace_obj


def finish_trace(
    trace_id: Optional[str] = None,
    status: str = "ok",
    latency_ms: Optional[int] = None,
) -> dict[str, Any]:
    """Manually finish a trace."""
    client = LuminaClient()
    ctx = get_run_context()
    tid = trace_id or ctx.trace_id
    if not tid:
        raise ValueError("trace_id is required")
    if ctx.trace_id == tid:
        ctx.trace_id = None
    return client.patch_trace(tid, status=status, latency_ms=latency_ms)


def start_span(
    name: str,
    *,
    span_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    parent_span_id: Optional[str] = None,
    kind: str = "internal",
    input_data: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Manually start a span (use ``span()`` context manager preferred)."""
    ctx = get_run_context()
    tid = trace_id or ctx.trace_id
    if not tid:
        raise ValueError("trace_id is required")

    client = LuminaClient()
    sid = span_id or str(uuid.uuid4())
    span_obj = client.create_span(
        tid,
        name,
        span_id=sid,
        parent_span_id=parent_span_id or ctx.span_id,
        kind=kind,
        input_data=input_data,
    )
    ctx.span_id = sid
    return span_obj


def finish_span(
    span_id: Optional[str] = None,
    status: str = "ok",
    output_data: Optional[dict[str, Any]] = None,
    latency_ms: Optional[int] = None,
) -> dict[str, Any]:
    """Manually finish a span."""
    client = LuminaClient()
    ctx = get_run_context()
    sid = span_id or ctx.span_id
    if not sid:
        raise ValueError("span_id is required")
    if ctx.span_id == sid:
        ctx.span_id = None
    return client.patch_span(sid, status=status, output_data=output_data, latency_ms=latency_ms)
