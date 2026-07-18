"""Sweep support for the Lumina backend."""

from __future__ import annotations

import itertools
import math
import random
from typing import Any, Callable, Optional

from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


class SweepConfig:
    """Parsed sweep configuration."""

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
        """Heuristic Bayesian-ish fallback without external dependencies.

        Uses the best historical observation and perturbs continuous parameters
        around it, while biasing categorical/values parameters toward better ones.
        This is not a full Bayesian optimizer but keeps the API compatible.
        """
        if not observations:
            return self.suggest_random()

        # Sort by metric value
        reverse = goal == "maximize"
        sorted_obs = sorted(observations, key=lambda x: x[1], reverse=reverse)
        best_params = sorted_obs[0][0]

        suggestion: dict[str, Any] = {}
        for name, spec in self.parameters.items():
            if "values" in spec:
                values = spec["values"]
                # Weight values by their average metric score
                value_scores: dict[Any, list[float]] = {v: [] for v in values}
                for params, metric in observations:
                    if name in params:
                        value_scores[params[name]].append(metric)
                avg_scores = {
                    v: (sum(scores) / len(scores) if scores else float("inf"))
                    for v, scores in value_scores.items()
                }
                ordered = sorted(values, key=lambda v: avg_scores[v], reverse=reverse)
                # 70% pick best, 30% random
                suggestion[name] = ordered[0] if random.random() < 0.7 else random.choice(values)
            elif "min" in spec and "max" in spec:
                mn = spec["min"]
                mx = spec["max"]
                dist = spec.get("distribution", "uniform")
                best = best_params.get(name)
                if best is None:
                    best = (mn + mx) / 2
                # Perturb around best value with decreasing sigma
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


def agent(
    sweep_id: str,
    function: Optional[Callable[[dict[str, Any]], dict[str, Any]]] = None,
    count: int = 5,
    project: Optional[str] = None,
    **kwargs,
) -> list[dict[str, Any]]:
    """Run sweep trials locally against the Lumina backend."""
    client = LuminaClient()
    sweep_obj = client._request("GET", f"/api/v1/sweeps/{sweep_id}")
    cfg = SweepConfig(sweep_obj.get("config", {}))
    method = sweep_obj.get("method", "random")

    ctx = get_run_context()
    project_name = project or ctx.project
    if not project_name:
        raise ValueError("project is required when no run context exists")

    metric_name = cfg.metric.get("name") if cfg.metric else None
    goal = cfg.metric.get("goal", "minimize") if cfg.metric else "minimize"

    # For grid/random we can generate all params upfront; Bayes is sequential.
    param_sets: list[dict[str, Any]] = []
    if method == "grid":
        param_sets = cfg.suggest_grid()[:count]
    elif method == "random":
        param_sets = [cfg.suggest_random() for _ in range(count)]

    results: list[dict[str, Any]] = []
    observations: list[tuple[dict[str, Any], float]] = []

    for idx in range(count):
        if method == "bayes":
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
        if function:
            try:
                summary = function(params) or {}
            except Exception as e:
                summary = {"error": str(e)}
        # Log summary metrics if provided
        if metric_name and metric_name in summary:
            value = summary[metric_name]
            if isinstance(value, (int, float)):
                client.log_metrics(run["runId"], {metric_name: value})
                observations.append((params, value))
        client.finish_run(run["runId"])
        results.append({"run": run, "params": params, "summary": summary})

    return results


def get_sweep(sweep_id: str) -> dict[str, Any]:
    """Get sweep details including associated runs."""
    client = LuminaClient()
    return client._request("GET", f"/api/v1/sweeps/{sweep_id}")
