"""Sweep support for the Lumina backend.

The optimizer itself lives server-side (`/sweeps/:id/suggest` returns
candidates from a Gaussian Process + Expected Improvement acquisition).
This module keeps a local Latin-Hypercube / heuristic fallback for
offline use and for older servers that haven't enabled the GP endpoint.

Each agent loop now also consults `/sweeps/:id/should-terminate` after
the user function reports a metric, so underperforming trials can stop
early (median pruning or Hyperband bracket pruning).
"""

from __future__ import annotations

import itertools
import math
import random
from typing import Any, Callable, Optional

from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


class SweepConfig:
    """Parsed sweep configuration. Local fallback suggester used when the
    server doesn't expose ``/suggest`` (older Lumina versions or 501s)."""

    def __init__(self, config: dict[str, Any]):
        self.parameters = config.get("parameters", {})
        self.metric = config.get("metric")
        self.early_terminate = config.get("early_terminate")

    def suggest_random(self) -> dict[str, Any]:
        return {name: self._sample_random(spec) for name, spec in self.parameters.items()}

    def suggest_grid(self) -> list[dict[str, Any]]:
        keys = list(self.parameters.keys())
        value_lists = [self._grid_values(self.parameters[k]) for k in keys]
        return [dict(zip(keys, combo)) for combo in itertools.product(*value_lists)]

    def suggest_bayes(
        self,
        observations: list[tuple[dict[str, Any], float]],
        goal: str = "minimize",
    ) -> dict[str, Any]:
        """Heuristic Bayesian fallback without external dependencies.

        Kept for offline / fallback use only. The server-side ``/suggest``
        endpoint implements a real Gaussian Process surrogate with
        Expected Improvement acquisition and is preferred when available.
        """
        if not observations:
            return self.suggest_random()

        reverse = goal == "maximize"
        sorted_obs = sorted(observations, key=lambda x: x[1], reverse=reverse)
        best_params = sorted_obs[0][0]

        suggestion: dict[str, Any] = {}
        for name, spec in self.parameters.items():
            if "values" in spec:
                values = spec["values"]
                value_scores: dict[Any, list[float]] = {v: [] for v in values}
                for params, metric in observations:
                    if name in params:
                        value_scores[params[name]].append(metric)
                avg_scores = {
                    v: (sum(scores) / len(scores) if scores else float("inf"))
                    for v, scores in value_scores.items()
                }
                ordered = sorted(values, key=lambda v: avg_scores[v], reverse=reverse)
                suggestion[name] = ordered[0] if random.random() < 0.7 else random.choice(values)
            elif "min" in spec and "max" in spec:
                mn = spec["min"]
                mx = spec["max"]
                dist = spec.get("distribution", "uniform")
                best = best_params.get(name)
                if best is None:
                    best = (mn + mx) / 2
                sigma = (mx - mn) / (6 + len(observations) * 0.5)
                if dist == "log_uniform":
                    log_best = math.log10(best)
                    log_sigma = (math.log10(mx) - math.log10(mn)) / (6 + len(observations) * 0.5)
                    val = 10 ** max(math.log10(mn), min(math.log10(mx), random.gauss(log_best, log_sigma)))
                else:
                    val = max(mn, min(mx, random.gauss(best, sigma)))
                suggestion[name] = val
            else:
                suggestion[name] = best_params.get(name)
        return suggestion

    @staticmethod
    def _sample_random(spec: dict[str, Any]) -> Any:
        if "values" in spec:
            return random.choice(spec["values"])
        if "min" in spec and "max" in spec:
            mn = spec["min"]
            mx = spec["max"]
            dist = spec.get("distribution", "uniform")
            if dist == "log_uniform":
                return 10 ** random.uniform(math.log10(mn), math.log10(mx))
            if dist == "normal":
                mean = (mn + mx) / 2
                sigma = (mx - mn) / 6
                return max(mn, min(mx, random.gauss(mean, sigma)))
            return random.uniform(mn, mx)
        raise ValueError(f"Unsupported parameter spec: {spec}")

    @staticmethod
    def _grid_values(spec: dict[str, Any]) -> list[Any]:
        if "values" in spec:
            return spec["values"]
        raise ValueError(f"Grid search requires 'values' for parameter: {spec}")


def sweep(
    config: dict[str, Any],
    project: Optional[str] = None,
    name: Optional[str] = None,
    **kwargs,
) -> dict[str, Any]:
    """Create a sweep on the Lumina backend."""
    client = LuminaClient()
    ctx = get_run_context()
    project_name = project or ctx.project
    if not project_name:
        raise ValueError("project is required when no run context exists")

    project_obj = client.get_project_by_name(project_name)
    if not project_obj:
        project_obj = client._request("POST", "/api/v1/projects", {"name": project_name})

    method = config.get("method", "random")
    cfg_payload: dict[str, Any] = {"parameters": config.get("parameters", {})}
    if config.get("metric"):
        cfg_payload["metric"] = config["metric"]
    if config.get("early_terminate"):
        cfg_payload["early_terminate"] = config["early_terminate"]

    base_name = name or f"sweep-{method}"
    sweep_name = base_name
    existing = client._request("GET", f"/api/v1/projects/{project_obj['id']}/sweeps")
    names = {s.get("name") for s in existing.get("items", [])}
    counter = 1
    while sweep_name in names:
        sweep_name = f"{base_name}-{counter}"
        counter += 1

    payload = {
        "name": sweep_name,
        "method": method,
        "config": cfg_payload,
    }
    return client._request("POST", f"/api/v1/projects/{project_obj['id']}/sweeps", payload)


def _request_server_suggest(
    client: LuminaClient, sweep_id: str, count: int
) -> Optional[list[dict[str, Any]]]:
    """Ask the server for a Bayesian-suggested candidate. Returns ``None``
    if the server doesn't implement ``/suggest`` (older Lumina)."""
    try:
        resp = client._request(
            "POST", f"/api/v1/sweeps/{sweep_id}/suggest", {"count": count}
        )
    except Exception:
        return None
    candidates = resp.get("candidates") if isinstance(resp, dict) else None
    if not isinstance(candidates, list):
        return None
    return candidates


def _request_early_termination(
    client: LuminaClient,
    sweep_id: str,
    run_id: str,
    step: int,
    metric: float,
) -> tuple[bool, Optional[str]]:
    try:
        resp = client._request(
            "POST",
            f"/api/v1/sweeps/{sweep_id}/should-terminate",
            {"runId": run_id, "step": step, "metric": metric},
        )
    except Exception:
        return False, None
    if not isinstance(resp, dict):
        return False, None
    return bool(resp.get("shouldTerminate", False)), resp.get("reason")


def _record_best(client: LuminaClient, sweep_id: str) -> None:
    try:
        client._request("POST", f"/api/v1/sweeps/{sweep_id}/record-best", {})
    except Exception:
        pass


def agent(
    sweep_id: str,
    function: Optional[Callable[[dict[str, Any]], dict[str, Any]]] = None,
    count: int = 5,
    project: Optional[str] = None,
    on_trial_terminate: Optional[Callable[[dict[str, Any], str], None]] = None,
    **kwargs,
) -> list[dict[str, Any]]:
    """Run sweep trials locally against the Lumina backend.

    For ``method == "bayes"`` the SDK now prefers the server-side
    ``/sweeps/:id/suggest`` endpoint (real Gaussian Process + Expected
    Improvement) and falls back to the local heuristic ``suggest_bayes``
    when the server is older.

    When the sweep config includes an ``early_terminate`` block, each
    reported (step, metric) pair is checked against the server's
    ``/should-terminate`` endpoint. Returning ``True`` causes the current
    run to be finished with status ``early_terminated`` so the trial
    stops but its observations are still recorded.
    """
    client = LuminaClient()
    sweep_obj = client._request("GET", f"/api/v1/sweeps/{sweep_id}")
    cfg = SweepConfig(sweep_obj.get("config", {}))
    method = sweep_obj.get("method", "random")
    et_cfg = cfg.early_terminate or {}

    ctx = get_run_context()
    project_name = project or ctx.project
    if not project_name:
        raise ValueError("project is required when no run context exists")

    metric_name = cfg.metric.get("name") if cfg.metric else None
    goal = cfg.metric.get("goal", "minimize") if cfg.metric else "minimize"

    param_sets: list[dict[str, Any]] = []
    if method == "grid":
        param_sets = cfg.suggest_grid()[:count]
    elif method == "random":
        param_sets = [cfg.suggest_random() for _ in range(count)]

    results: list[dict[str, Any]] = []
    observations: list[tuple[dict[str, Any], float]] = []

    use_server_bayes = method == "bayes"

    for idx in range(count):
        if method == "bayes":
            server_candidates = _request_server_suggest(client, sweep_id, 1)
            if server_candidates:
                params = server_candidates[0]
            else:
                params = cfg.suggest_bayes(observations, goal=goal)
        elif method == "grid":
            if idx >= len(param_sets):
                break
            params = param_sets[idx]
        else:
            params = cfg.suggest_random()

        run_name = f"{sweep_obj.get('name', 'run')}-{idx + 1}"
        run = client.create_run(project_name, name=run_name, config=params, sweep_id=sweep_id)
        summary: dict[str, Any] = {}
        terminated = False
        if function:
            try:
                summary = function(params) or {}
            except Exception as e:
                summary = {"error": str(e)}

        # Multi-step early termination: if the user returns {"history":
        # [{step, metric}, ...]} we evaluate each step against the server
        # and stop on the first hit. Otherwise we use the scalar metric
        # at step `count`.
        if metric_name and et_cfg:
            history = summary.get("history") if isinstance(summary, dict) else None
            if isinstance(history, list) and history:
                for entry in history:
                    step = int(entry.get("step", 0))
                    metric = entry.get(metric_name)
                    if not isinstance(metric, (int, float)):
                        continue
                    should, reason = _request_early_termination(
                        client, sweep_id, run["runId"], step, float(metric)
                    )
                    if should:
                        terminated = True
                        summary["_early_terminated"] = {"step": step, "reason": reason}
                        if on_trial_terminate:
                            try:
                                on_trial_terminate(params, reason or "")
                            except Exception:
                                pass
                        break
            elif isinstance(summary.get(metric_name), (int, float)):
                should, reason = _request_early_termination(
                    client,
                    sweep_id,
                    run["runId"],
                    int(summary.get("step", idx + 1)),
                    float(summary[metric_name]),
                )
                if should:
                    terminated = True
                    summary["_early_terminated"] = {"reason": reason}

        # Log summary metrics if provided
        if metric_name and metric_name in summary:
            value = summary[metric_name]
            if isinstance(value, (int, float)):
                client.log_metrics(run["runId"], {metric_name: value})
                observations.append((params, value))

        client.finish_run(
            run["runId"],
            status="early_terminated" if terminated else "finished",
        )
        results.append({"run": run, "params": params, "summary": summary, "terminated": terminated})

    if metric_name:
        _record_best(client, sweep_id)
    return results


def get_sweep(sweep_id: str) -> dict[str, Any]:
    """Get sweep details including associated runs."""
    client = LuminaClient()
    return client._request("GET", f"/api/v1/sweeps/{sweep_id}")


def list_observations(sweep_id: str) -> list[dict[str, Any]]:
    """Return all (params, metric) observations recorded for the sweep."""
    client = LuminaClient()
    resp = client._request("GET", f"/api/v1/sweeps/{sweep_id}/observations")
    return list(resp.get("items", [])) if isinstance(resp, dict) else []