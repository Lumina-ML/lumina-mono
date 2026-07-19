"""Performance benchmark: Lumina backend ingestion throughput.

Measures how fast the backend accepts writes across the hot paths, then reports
the results themselves as a Lumina run so throughput can be tracked over time:

  (a) metric ingestion — points/sec across several batch sizes
  (b) log-line ingestion — lines/sec
  (c) artifact upload — MB/sec
  (d) trace spans — spans/sec

All timings use ``time.perf_counter`` (wall clock). Counts are modest so the
whole suite finishes in a few seconds against a local server.
"""

import os
import tempfile
import uuid

import lumina
from _common import Timer, check_server, ensure_auth, percentile, resolve_project
from lumina.backend.client import LuminaClient

PROJECT = "benchmark-throughput"

# (batch_size, num_batches) — batch_size is points-per-request (server cap 1000).
METRIC_PLAN = [(1, 20), (50, 20), (200, 10), (1000, 5)]
NUM_LOG_LINES = 500
LOG_LINE_BATCH = 100
ARTIFACT_MB = 5
NUM_SPANS = 30


def bench_metric_ingest(client: LuminaClient, run_id: str) -> list[dict]:
    """Return a throughput record per batch size."""
    records = []
    step = 0
    for batch_size, num_batches in METRIC_PLAN:
        payload = {f"m{i}": 0.0 for i in range(batch_size)}
        latencies = []
        with Timer() as t:
            for _ in range(num_batches):
                step += 1
                with Timer() as bt:
                    client.log_metrics(run_id, payload, step=step)
                latencies.append(bt.elapsed * 1000)
        total_points = batch_size * num_batches
        pts_per_s = total_points / t.elapsed if t.elapsed else 0.0
        rec = {
            "batch_size": batch_size,
            "points": total_points,
            "points_per_s": round(pts_per_s, 1),
            "batch_p50_ms": round(percentile(latencies, 50), 2),
            "batch_p95_ms": round(percentile(latencies, 95), 2),
        }
        records.append(rec)
        print(f"  metrics batch={batch_size:>4}: {rec['points_per_s']:>10.1f} pts/s  p95={rec['batch_p95_ms']}ms")
    return records


def bench_log_lines(client: LuminaClient, run_id: str) -> float:
    with Timer() as t:
        for start in range(0, NUM_LOG_LINES, LOG_LINE_BATCH):
            batch = [
                {"level": "INFO", "message": f"log line {n}", "step": n}
                for n in range(start, min(start + LOG_LINE_BATCH, NUM_LOG_LINES))
            ]
            client.log_lines(run_id, batch)
    rate = NUM_LOG_LINES / t.elapsed if t.elapsed else 0.0
    print(f"  log lines: {rate:.1f} lines/s ({NUM_LOG_LINES} in {t.elapsed:.2f}s)")
    return rate


def bench_artifact_upload() -> float:
    data = os.urandom(ARTIFACT_MB * 1024 * 1024)
    with tempfile.NamedTemporaryFile("wb", suffix=".bin", delete=False) as f:
        f.write(data)
        path = f.name
    art = lumina.LuminaArtifact(name=f"throughput-blob-{uuid.uuid4().hex[:8]}", type="file")
    art.add_file(path)
    with Timer() as t:
        art.save(project=PROJECT, version="v1")
    rate = ARTIFACT_MB / t.elapsed if t.elapsed else 0.0
    print(f"  artifact upload: {rate:.2f} MB/s ({ARTIFACT_MB}MB in {t.elapsed:.2f}s)")
    return rate


def bench_trace_spans() -> float:
    trace_id = lumina.start_trace("throughput-trace", project=PROJECT)["traceId"]
    with Timer() as t:
        for i in range(NUM_SPANS):
            s = lumina.start_span(f"span-{i}", kind="internal", input_data={"i": i})
            lumina.finish_span(s["spanId"], status="ok", output_data={"i": i}, latency_ms=1)
    lumina.finish_trace(trace_id, status="ok", latency_ms=int(t.elapsed * 1000))
    rate = NUM_SPANS / t.elapsed if t.elapsed else 0.0
    print(f"  trace spans: {rate:.1f} spans/s ({NUM_SPANS} in {t.elapsed:.2f}s)")
    return rate


def main() -> None:
    check_server()
    ensure_auth("throughput")
    resolve_project(PROJECT)
    client = LuminaClient()

    # A dedicated target run to absorb the metric/log stress writes.
    target = client.create_run(PROJECT, name="throughput-target")
    target_run_id = target["runId"]

    print("Running throughput benchmark...")
    metric_records = bench_metric_ingest(client, target_run_id)
    lines_per_s = bench_log_lines(client, target_run_id)
    mb_per_s = bench_artifact_upload()
    spans_per_s = bench_trace_spans()
    client.finish_run(target_run_id)

    # Report the results as their own run.
    run = lumina.init(
        project=PROJECT,
        name="throughput-results",
        config={
            "metric_plan": METRIC_PLAN,
            "num_log_lines": NUM_LOG_LINES,
            "artifact_mb": ARTIFACT_MB,
            "num_spans": NUM_SPANS,
        },
    )
    # Metric ingestion forms a small series keyed by batch size.
    for rec in metric_records:
        run.log(
            {"ingest/points_per_s": rec["points_per_s"], "ingest/batch_p95_ms": rec["batch_p95_ms"]},
            step=rec["batch_size"],
        )
    peak_pts = max(r["points_per_s"] for r in metric_records)
    run.summary["peak_points_per_s"] = peak_pts
    run.summary["log_lines_per_s"] = round(lines_per_s, 1)
    run.summary["artifact_mb_per_s"] = round(mb_per_s, 2)
    run.summary["trace_spans_per_s"] = round(spans_per_s, 1)
    run.finish()

    report = lumina.LuminaReport(title="Throughput Benchmark", project=PROJECT, created_by="benchmark")
    report.add_text("Backend ingestion throughput across metric / log / artifact / trace paths.")
    report.add_metric("peak_points_per_s", peak_pts)
    report.add_metric("log_lines_per_s", round(lines_per_s, 1))
    report.add_metric("artifact_mb_per_s", round(mb_per_s, 2))
    report.add_metric("trace_spans_per_s", round(spans_per_s, 1))
    report.add_run_gallery([run["runId"]])
    saved = report.save()
    print(f"\nReport: {saved['id']}  |  peak={peak_pts} pts/s  {mb_per_s:.2f} MB/s  {spans_per_s:.1f} spans/s")


if __name__ == "__main__":
    main()
