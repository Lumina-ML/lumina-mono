"""Business benchmark: RAG / agent pipeline observability.

Simulates a multi-query RAG agent and reports LLM observability to Lumina:
- one trace per user query, with nested spans: retriever -> llm -> tool
- per-span latency and token/output payloads
- per-query aggregate latency + token counts logged as run metrics
- p50/p95 latency and total token summary on the run

Latencies/tokens are synthesized (small sleeps) so it runs without real models.
"""

import os
import random
import time

import lumina
from _common import Timer, check_server, ensure_auth, percentile

PROJECT = "benchmark-rag"

QUERIES = [
    "What is the capital of France?",
    "Summarize the Q3 earnings report.",
    "How do I reset my password?",
    "Compare product A and product B.",
    "What are the store hours on weekends?",
    "Explain the refund policy.",
]


def _span(name: str, kind: str, input_data: dict, work_s: float, output_data: dict) -> int:
    """Run one span, sleeping ``work_s`` to simulate work. Returns latency ms."""
    s = lumina.start_span(name, kind=kind, input_data=input_data)
    time.sleep(work_s)
    latency_ms = int(work_s * 1000)
    lumina.finish_span(s["spanId"], status="ok", output_data=output_data, latency_ms=latency_ms)
    return latency_ms


def main() -> None:
    check_server()
    ensure_auth("rag")

    run = lumina.init(
        project=PROJECT,
        name="rag-agent-benchmark",
        config={"model": "gpt-4", "retriever": "bm25+embedding", "top_k": 4},
    )
    print(f"Run: {run['runId']}")

    latencies: list[float] = []
    total_tokens = 0

    with Timer() as timer:
        for i, query in enumerate(QUERIES):
            trace_id = lumina.start_trace(
                "agent-query", project=PROJECT, metadata={"query": query, "idx": i}
            )["traceId"]

            q_start = time.perf_counter()
            # Retriever span.
            n_docs = random.randint(3, 6)
            retr_ms = _span(
                "retrieve", "retriever",
                {"query": query, "top_k": 4},
                random.uniform(0.01, 0.04),
                {"docs_found": n_docs},
            )
            # LLM span.
            prompt_tokens = random.randint(200, 600)
            completion_tokens = random.randint(50, 300)
            llm_ms = _span(
                "llm-call", "llm",
                {"prompt_tokens": prompt_tokens, "context_docs": n_docs},
                random.uniform(0.03, 0.08),
                {"completion_tokens": completion_tokens, "finish_reason": "stop"},
            )
            # Tool span (roughly half the queries invoke a tool).
            tool_ms = 0
            if i % 2 == 0:
                tool_ms = _span(
                    "tool-call", "tool",
                    {"tool": "search_kb", "args": {"q": query}},
                    random.uniform(0.01, 0.03),
                    {"result": "ok"},
                )

            query_ms = int((time.perf_counter() - q_start) * 1000)
            query_tokens = prompt_tokens + completion_tokens
            latencies.append(query_ms)
            total_tokens += query_tokens

            lumina.finish_trace(trace_id, status="ok", latency_ms=query_ms)
            run.log(
                {
                    "query/latency_ms": query_ms,
                    "query/tokens": query_tokens,
                    "span/retriever_ms": retr_ms,
                    "span/llm_ms": llm_ms,
                    "span/tool_ms": tool_ms,
                },
                step=i,
            )
            print(f"  q{i}: {query_ms}ms  tokens={query_tokens}  docs={n_docs}")

    run.summary["num_queries"] = len(QUERIES)
    run.summary["total_tokens"] = total_tokens
    run.summary["latency_p50_ms"] = round(percentile(latencies, 50), 2)
    run.summary["latency_p95_ms"] = round(percentile(latencies, 95), 2)
    run.summary["wall_seconds"] = round(timer.elapsed, 3)
    run.finish()

    print(
        f"Done: {len(QUERIES)} queries  "
        f"p50={run.summary['latency_p50_ms']}ms  p95={run.summary['latency_p95_ms']}ms  "
        f"tokens={total_tokens}"
    )


if __name__ == "__main__":
    main()
