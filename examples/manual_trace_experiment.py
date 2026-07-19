"""Manual trace/span API example for Lumina backend.

The ``trace()`` / ``span()`` context managers (see ``trace_experiment.py``) are
preferred, but the manual ``start_*`` / ``finish_*`` functions give explicit
control over nesting, latency and output payloads — useful when span
boundaries don't line up with Python ``with`` blocks (e.g. async callbacks).
"""

import os
import time

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    trace_obj = lumina.start_trace(
        "agent-request",
        project="demo",
        metadata={"model": "gpt-4", "user": "demo"},
    )
    trace_id = trace_obj["traceId"]
    print(f"Trace: {trace_id}")
    t0 = time.perf_counter()

    # Retriever span.
    retr = lumina.start_span("retrieve", kind="retriever", input_data={"query": "weather in SF"})
    time.sleep(0.02)
    lumina.finish_span(
        retr["spanId"],
        status="ok",
        output_data={"docs": 3},
        latency_ms=20,
    )

    # LLM span nested logically after retrieval; pass parent explicitly.
    llm = lumina.start_span(
        "llm-call",
        kind="llm",
        parent_span_id=retr["spanId"],
        input_data={"messages": [{"role": "user", "content": "weather?"}]},
    )
    time.sleep(0.03)
    lumina.finish_span(
        llm["spanId"],
        status="ok",
        output_data={"tokens": 128, "finish_reason": "stop"},
        latency_ms=30,
    )

    total_ms = int((time.perf_counter() - t0) * 1000)
    lumina.finish_trace(trace_id, status="ok", latency_ms=total_ms)
    print(f"Trace finished in {total_ms}ms")


if __name__ == "__main__":
    main()
