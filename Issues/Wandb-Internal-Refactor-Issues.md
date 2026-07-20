# Wandb Internal Refactor Issues

This file tracks gaps, blockers, and follow-ups discovered while migrating the
Lumina Python SDK off the WandB reporting path (`lumina/sdk/`) onto the Lumina
backend (`lumina/backend/`).

> **Project principle**: no WandB capability may be dropped — every public API
> must keep working. Only the underlying reporting/transport is rewritten.

---

## Step 3.1 — `lumina.init()` cutover to Lumina backend

Status: in progress (commit pending).

### `Run` public surface not yet ported to `LuminaRun`

Captured by diffing `python/lumina/lumina/sdk/wandb_run.py` against
`python/lumina/lumina/backend/run.py`. These methods exist on `Run` but **not**
on `LuminaRun`. They were reachable through `lumina.init() → Run` in the old
dispatch, so the cutover removes a real call site for each of them.

| Category | Missing methods | Notes |
|---|---|---|
| Lifecycle | `start`, `stop`, `join`, `status`, `check_network_status` | `LuminaRun.finish()` exists; sync-status introspection needs backend support (`/api/v1/runs/:id/sync-status`?). |
| Properties (read/write) | `notes`, `tags`, `entity`, `group`, `job_type`, `config_static` | Read-only `name`/`project` exist; write-side semantics + storage in `LuminaRun.metadata` need design. |
| State flags | `offline`, `disabled`, `resumed`, `start_time`, `starting_step` | `disabled`/`offline` are global package modes (`lumina.init(mode="disabled")`), not per-run; `start_time` should be derivable from the server. |
| Artifact ops | `link_artifact`, `finish_artifact`, `upsert_artifact` | `log_artifact` / `use_artifact` exist on `LuminaRun`. Lineage / multi-version finalize need backend endpoints. |
| Code | `log_code` | Snapshot-and-upload a script/requirements as an Artifact. Needs ArtifactManifest API support on the server. |
| URLs | `get_url`, `get_project_url`, `get_sweep_url`, `project_url`, `sweep_url` | Only `url` (run) exists; project/sweep URL composition depends on dashboard routes. |
| Display (Jupyter) | `display`, `to_html` | `sdk/wandb_run.py` uses `IPython.display`. Lowest priority — render as `<a href={self.url}>`. |
| Misc | `write_logs`, `settings`, `wrapper`, `wrapper_fn` | `wrapper`/`wrapper_fn` are internal decorators. `write_logs` is the file-stream consumer. |

### Module-level (`lumina.*`) methods not yet on `LuminaRun`

Some methods are exposed at the `lumina` module level (not on the Run object)
and already routed through `lumina.backend.*`:

- `lumina.log_model` / `use_model` / `link_model` — `__init__.py:258-292` ✅
- `lumina.init_eval` / `log_eval_*` / `finish_eval` — `__init__.py:294-308` ✅
- `lumina.trace` / `span` / `start_*` / `finish_*` — `__init__.py:310-346` ✅
- `lumina.log_media`, `lumina.launch`, `lumina.launch_agent` — `__init__.py:348-360` ✅
- `lumina.login` — `__init__.py:109` ✅
- `lumina.define_metric`, `lumina.alert`, `lumina.mark_preempting` — `__init__.py:360-374` (PreInitCallable; bound to Run on init)

### Risks specific to the cutover

1. **Bare `lumina.init()` (no project, no `LUMINA_API_URL`)** — now defaults to
   `http://localhost:8000`. If no local Lumina server is running, the call
   fails with a `LuminaClientError`. Previously it would silently call
   `wandb.init()` against `api.wandb.ai`. Mitigation: clearer error message
   when nothing is reachable; document the env var in the error.
2. **Users who depended on `lumina.init() → Run`** — `Run` is still importable
   directly via `from lumina.sdk.wandb_run import Run`, but auto-globals
   (`lumina.run`, `lumina.config`, ...) are rebound to the `LuminaRun`
   instance, which has fewer methods. Code calling `lumina.run.notes = "..."`
   will now hit `AttributeError`.
3. **`test_run_stubs.py`** — tests `LuminaRun` directly against `fake_backend`,
   not `lumina.init()`, so it should be unaffected. To verify post-cutover.

### Follow-ups discovered during step 3.1

- **`finish()` still has a `_WANDB_FINISH` fallback** at `__init__.py:190`.
  After the `init()` cutover, the only way to reach it is calling
  `lumina.finish()` without ever calling `lumina.init()` and without an
  active run-context. Behavior is currently "fall through to
  `sdk.wandb_run.Run.finish()`". Should be cut over in step 3.1b (next
  step) for consistency — replace fallback with explicit no-op + reset.
  ✅ **Done in 3.1b** — fallback replaced with no-op, `_WANDB_FINISH` removed.
- **Dead aliases**: `_WANDB_INIT = wandb_sdk.init` (line 53) was removed in
  3.1. `_WANDB_FINISH` removed in 3.1b. ✅
- **`lumina.setup` / `lumina.attach` / `lumina.teardown`** still bind to
  `wandb_sdk.*`. Not used by `init()`/`finish()` directly, but exposed as
  public API. Out of scope for step 3.1; track for step 3.1c or later.

---

## Pre-existing branch issue (not caused by step 3.1, but blocks runtime verification)

### Broken import in `lumina/agents/agent.py` (untracked file on this branch)

```
File "lumina/agents/agent.py", line 19, in <module>
    from lumina.lumina.agents.run import RunStatus
ModuleNotFoundError: No module named 'lumina.lumina'
```

The path is wrong (extra `lumina.` segment). The new `lumina/agents/`
package is untracked (`git status` shows `??` on `agent.py`/`job.py`/
`run.py`), so this is parallel WIP — not from any prior commit.

This blocks **`import lumina` at all** because `lumina.sdk.lib.run_stopping`
imports `lumina.agents.pyagent` → `lumina.agents` → `lumina.agents.agent`
→ broken import.

**Workaround for verification**: `import lumina.backend` directly (works
because it doesn't touch `lumina.sdk.lib`). Step 3.1 cutover lives at the
top-level `lumina/__init__.py`, so its syntax/semantics have to be verified
via:

1. `python -m py_compile lumina/__init__.py` ✅
2. AST inspection of the new `init()` body — no `LUMINA_API_URL` gate,
   always calls `LuminaClient().create_run(...)`.
3. Once the broken import is fixed, full `import lumina` + `lumina.init()`
   smoke test against `fake_backend`.

**Fix to consider** (one-liner):

```diff
- from lumina.lumina.agents.run import RunStatus
+ from lumina.agents.run import RunStatus
```

Should the fix be a follow-up commit on this branch, or revert to whatever
import shape the untracked `agents/` module was checked out from? Ask the
branch owner (the person who added `lumina/agents/`).

---

## Later steps (not started)

- **Step 3.2 — `sdk/internal/sender.py` metric/log redirect**
- **Step 3.3 — `sdk/internal/file_stream.py` file-stream redirect**
- **Step 3.4 — `sdk/internal/file_pusher.py` artifact upload redirect**
- **Step 3.5 — `sdk/internal/internal_api.py` GraphQL → REST rewrite (largest)**
- **Step 3.6 — Delete `sdk/internal/_generated/` 26 GraphQL files**

Add new issues here as they're discovered.