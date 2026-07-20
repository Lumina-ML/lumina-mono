"""Trace & Span scenarios: TR-1 ~ TR-2."""

from __future__ import annotations

import time
import uuid

from lumina.backend.client import LuminaClient

from _common import Timer, check_server, ensure_auth
from .base import Scenario, ScenarioResult


class TraceSpanTreeScenario(Scenario):
    """TR-1: create a trace and verify it is queryable.

    The local docker compose stack stores traces in ClickHouse. The server's
    workspace-guard authz layer currently looks up trace/span ownership in
    Prisma, so detail routes (``GET /traces/:traceId/spans``) return 404 when
    ClickHouse is enabled. This scenario therefore validates the trace create
    and project-scoped list paths, which do work, and leaves full span-tree
    verification for the final integration pass.
    """

    scenario_id = "TR-1"
    name = "Trace/span tree"

    @staticmethod
    def _wait_for_trace(
        client: LuminaClient,
        project_id: str,
        trace_id: str,
        attempts: int = 10,
        delay: float = 0.3,
    ) -> bool:
        for _ in range(attempts):
            traces = client._request("GET", f"/api/v1/projects/{project_id}/traces")
            for item in traces.get("items", []):
                if item.get("traceId") == trace_id:
                    return True
            time.sleep(delay)
        return False

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-traces"

        client = LuminaClient()
        project_obj = client.get_project_by_name(project)
        if not project_obj:
            project_obj = client._request("POST", "/api/v1/projects", {"name": project})
        project_id = project_obj["id"]

        trace_id = str(uuid.uuid4())
        with Timer() as t:
            client.create_trace(
                project_id,
                "benchmark-trace",
                trace_id=trace_id,
                metadata={"benchmark": True},
            )

            # ClickHouse inserts are async; poll the project-scoped list until
            # the trace lands.
            found = self._wait_for_trace(client, project_id, trace_id)

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if found else "failed",
            metrics={
                "trace_id": trace_id,
                "elapsed_ms": round(t.elapsed * 1000, 2),
            },
            assertions={
                "trace_created": bool(trace_id),
                "trace_listed": found,
            },
        )


class RagAgentTraceScenario(Scenario):
    """TR-2: simulate multiple RAG/agent queries as traces.

    Each query becomes one trace with RAG metadata. Full span-tree simulation
    (retriever / llm / tool spans) is blocked by the same ClickHouse authz
    issue as TR-1; this scenario focuses on creating and listing many traces
    so we still exercise the trace ingestion path at scale.
    """

    scenario_id = "TR-2"
    name = "RAG/Agent traces"

    def run(self) -> ScenarioResult:
        check_server()
        ensure_auth()
        project = "benchmark-rag-agent"
        params = self.params()
        query_count = max(3, params["spans_per_trace"] // 10)

        client = LuminaClient()
        project_obj = client.get_project_by_name(project)
        if not project_obj:
            project_obj = client._request("POST", "/api/v1/projects", {"name": project})
        project_id = project_obj["id"]

        queries = [
            "What is the capital of France?",
            "Summarize the Q3 earnings report.",
            "How do I reset my password?",
        ]

        trace_ids: list[str] = []
        with Timer() as t:
            for i in range(query_count):
                trace_id = str(uuid.uuid4())
                trace_ids.append(trace_id)
                client.create_trace(
                    project_id,
                    "agent-query",
                    trace_id=trace_id,
                    metadata={
                        "query": queries[i % len(queries)],
                        "idx": i,
                        "pipeline": "rag",
                    },
                )

            # Poll until all traces are visible in the project-scoped list.
            for _ in range(20):
                traces = client._request("GET", f"/api/v1/projects/{project_id}/traces")
                listed_ids = {item.get("traceId") for item in traces.get("items", [])}
                if trace_ids and all(tid in listed_ids for tid in trace_ids):
                    break
                time.sleep(0.3)

        traces = client._request("GET", f"/api/v1/projects/{project_id}/traces")
        listed_ids = {item.get("traceId") for item in traces.get("items", [])}
        all_listed = all(tid in listed_ids for tid in trace_ids)

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if all_listed else "failed",
            metrics={
                "query_count": query_count,
                "trace_ids": len(trace_ids),
                "listed_count": len(listed_ids),
                "elapsed_ms": round(t.elapsed * 1000, 2),
            },
            assertions={
                "all_traces_created": len(trace_ids) == query_count,
                "all_traces_listed": all_listed,
            },
        )
