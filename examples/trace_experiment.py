"""Trace/Span example for Lumina backend."""

import os

import lumina


def main():
    os.environ.setdefault("LUMINA_API_URL", "http://localhost:8000")

    with lumina.trace("chat-completion", project="demo", metadata={"model": "gpt-4"}) as trace_obj:
        print(f"Trace: {trace_obj['traceId']}")

        with lumina.span("retrieve-context", kind="retriever", input_data={"query": "hello"}) as span1:
            print(f"Span: {span1['spanId']}")

        with lumina.span("llm-call", kind="llm", input_data={"messages": [{"role": "user", "content": "hello"}]}) as span2:
            print(f"Span: {span2['spanId']}")

        with lumina.span("tool-call", kind="tool", input_data={"name": "calculator", "args": {"x": 1, "y": 2}}) as span3:
            print(f"Span: {span3['spanId']}")


if __name__ == "__main__":
    main()
