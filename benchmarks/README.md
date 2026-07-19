# Lumina Benchmarks

End-to-end **business-workflow simulations** and a **throughput benchmark** that
exercise the full Lumina stack and report their results back to the backend.
Each script is self-contained and runnable with `python benchmarks/<name>.py`.

Where [`../examples/`](../examples/README.md) demonstrates *individual SDK
features*, these benchmarks model *realistic end-to-end ML scenarios* and the
data volume that comes with them.

## Prerequisites

1. **Start the backend** (defaults to `http://localhost:8000`):

   ```bash
   docker compose up                 # full stack
   # …or lightweight: docker compose up postgres -d && pnpm --filter @lumina/server dev
   ```

2. **Install the SDK**:

   ```bash
   cd python/lumina && pip install -e .
   ```

3. **Optional**: `pip install numpy` enables sample-image logging in the CV
   benchmark (it skips those log calls cleanly otherwise).

All scripts read `LUMINA_API_URL` (default `http://localhost:8000`) and create a
throwaway user for authentication automatically.

## Run everything

```bash
python benchmarks/run_all.py
```

Runs each `*_benchmark.py` in an isolated subprocess and prints a
pass / skip / fail summary.

## Benchmarks

| Script | Project | Scenario | Reports |
| --- | --- | --- | --- |
| `llm_finetune_benchmark.py` | `benchmark-llm` | LLM SFT: cosine-LR training loop, per-epoch validation, checkpoints, evaluation | train/val loss + perplexity, model versions, eval, report |
| `cv_training_benchmark.py` | `benchmark-cv` | Image classification: accuracy/loss curves, sample images, confusion matrix, model↔dataset lineage | metrics, `Image`, `LuminaTable`, checkpoints, report |
| `rag_agent_benchmark.py` | `benchmark-rag` | RAG/agent pipeline: one trace per query with retriever→llm→tool spans | per-span latency/tokens, p50/p95 latency, token totals |
| `sweep_tabular_benchmark.py` | `benchmark-sweep` | Bayesian hyperparameter sweep over a GBDT with early termination | one run per trial, best model, report |
| `throughput_benchmark.py` | `benchmark-throughput` | Backend ingestion stress across the hot write paths | points/sec, lines/sec, artifact MB/s, spans/sec (reported as a run) |

## Interpreting the throughput benchmark

`throughput_benchmark.py` measures four hot paths and reports them as a run in
the `benchmark-throughput` project:

- **`ingest/points_per_s`** — a small series keyed by batch size. Larger batches
  amortize per-request overhead, so points/sec should rise with batch size. The
  server caps a single request at 1000 points.
- **`log_lines_per_s`**, **`artifact_mb_per_s`**, **`trace_spans_per_s`** — single
  summary values on the run.

The absolute numbers depend on your machine and which storage backends are
configured (Prisma/Postgres vs ClickHouse for metrics, local FS vs S3/MinIO for
artifacts). Compare runs against each other rather than to a fixed target.

## Verify reported data

```bash
curl "$LUMINA_API_URL/api/v1/projects"                 # see benchmark-* projects
# or open the dashboard at http://localhost:3000
```
