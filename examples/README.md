# Lumina SDK Examples

Standalone scripts that exercise every feature of the Lumina Python SDK against
a local backend. Each script is self-contained and runnable with
`python examples/<name>.py`.

## Prerequisites

1. **Start the backend** (defaults to `http://localhost:8000`):

   ```bash
   # Full stack (postgres + minio + clickhouse + redis + server + dashboard)
   docker compose up

   # …or lightweight local dev
   docker compose up postgres -d
   pnpm --filter @lumina/server db:migrate
   pnpm --filter @lumina/server dev
   ```

2. **Install the SDK** (editable):

   ```bash
   cd python/lumina && pip install -e .
   ```

3. **Optional dependencies** (only some examples need them; they skip cleanly if missing):

   ```bash
   pip install numpy pillow   # wandb_media_experiment.py
   pip install torch          # torch_watch_experiment.py
   ```

All scripts read `LUMINA_API_URL` (default `http://localhost:8000`). Set
`LUMINA_API_KEY` or run `auth_experiment.py` first if your server enforces auth.

## Run everything

```bash
python examples/run_all.py
```

Runs each `*_experiment.py` in an isolated subprocess and prints a
pass / skip / fail summary. Exit code is non-zero if any example fails.

## What each example covers

| Script | SDK surface |
| --- | --- |
| `basic_experiment.py` | `init`, `log`, `log_system`, `log_line`, `add_tag`, `finish` |
| `auth_experiment.py` | `create_user`, `login`, `get_current_user`, authenticated logging |
| `config_summary_experiment.py` | `run.config`, `run.summary`, `define_metric`, `run.save` + restore |
| `alert_preempt_experiment.py` | `pin_config_keys`, `alert` (INFO/WARN/ERROR), `mark_preempting` |
| `artifact_experiment.py` | `LuminaArtifact`, `use_lumina_artifact` |
| `artifact_lineage_experiment.py` | `link_artifacts`, `artifact_lineage`, `unlink_artifacts` |
| `model_registry_experiment.py` | `log_model`, `use_model` (versions + aliases) |
| `link_model_experiment.py` | `link_model` into the Model Registry |
| `evaluation_experiment.py` | `init_eval`, `log_eval_result`, `finish_eval` |
| `media_experiment.py` | `LuminaTable`, `log_media` |
| `wandb_media_experiment.py` | `lumina.Image` / `Histogram` / `Table` via `lumina.log` (needs numpy) |
| `trace_experiment.py` | `trace()` / `span()` context managers |
| `manual_trace_experiment.py` | `start_trace` / `start_span` / `finish_span` / `finish_trace` |
| `sweep_experiment.py` | `sweep`, `agent` (random search) |
| `report_experiment.py` | `LuminaReport` (text / metric / run gallery blocks) |
| `launch_experiment.py` | launch queues, jobs, `launch`, `launch_agent` |
| `torch_watch_experiment.py` | `run.watch` / `run.unwatch` gradient logging (needs torch) |

## Benchmarks

For end-to-end business-workflow simulations and throughput benchmarks that
report to Lumina, see [`../benchmarks/`](../benchmarks/README.md).
