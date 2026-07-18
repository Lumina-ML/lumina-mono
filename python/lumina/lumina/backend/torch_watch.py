"""PyTorch watch/unwatch support for LuminaRun.

This module provides a lightweight alternative to wandb.integration.torch that
logs scalar statistics (mean/std/min/max) for parameters and gradients instead
of full histograms. It avoids depending on wandb data types while still giving
useful insight into model training.
"""

from __future__ import annotations

from typing import Any, Callable


class _Counter:
    def __init__(self, threshold: int):
        self.count = 0
        self.threshold = threshold

    def tick(self) -> bool:
        self.count += 1
        if self.count < self.threshold:
            return False
        self.count = 0
        return True


def _tensor_stats(tensor: Any) -> dict[str, float] | None:
    """Return scalar statistics for a tensor."""
    try:
        t = tensor.detach().cpu()
        # Ignore non-finite values for robust stats.
        finite = t[t.isfinite()]
        if finite.numel() == 0:
            return None
        stats: dict[str, float] = {
            "mean": finite.mean().item(),
            "min": finite.min().item(),
            "max": finite.max().item(),
        }
        # std of a single element is undefined; use 0.0 in that case.
        if finite.numel() > 1:
            stats["std"] = finite.std().item()
        else:
            stats["std"] = 0.0
        # Defensive: drop any NaN/Inf that slipped through.
        return {k: v for k, v in stats.items() if isinstance(v, float) and (v == v) and (v != float("inf")) and (v != float("-inf"))}
    except Exception:
        return None


class LuminaTorchWatcher:
    """Watch PyTorch modules and log parameter/gradient statistics to a run."""

    def __init__(self, log_callback: Callable[[dict[str, Any]], None]):
        self._log_callback = log_callback
        self._handles: list[Any] = []

    def watch(
        self,
        models: Any,
        criterion: Any | None = None,
        log: str = "gradients",
        log_freq: int = 1000,
        idx: int | None = None,
        log_graph: bool = False,
    ) -> None:
        """Register hooks on one or more torch.nn.Module instances."""
        import torch

        if isinstance(models, torch.nn.Module):
            models = [models]

        track_params = log in ("parameters", "all")
        track_grads = log in ("gradients", "all")

        for model in models:
            if not isinstance(model, torch.nn.Module):
                raise TypeError("watch() expects a torch.nn.Module or a list of modules")

            if track_params:
                self._add_parameter_hook(model, log_freq)
            if track_grads:
                self._add_gradient_hooks(model, log_freq)

    def unwatch(self, models: Any | None = None) -> None:
        """Remove hooks.

        If ``models`` is None, remove all hooks managed by this watcher.
        """
        import torch

        if models is None:
            for handle in self._handles:
                handle.remove()
            self._handles = []
            return

        if isinstance(models, torch.nn.Module):
            models = [models]

        # We don't track per-model handles, so we remove all and re-add for
        # remaining models if needed. For typical usage this is sufficient.
        remaining: list[torch.nn.Module] = []
        for model in models:
            if isinstance(model, torch.nn.Module):
                remaining.append(model)
        for handle in self._handles:
            handle.remove()
        self._handles = []
        if remaining:
            self.watch(remaining)

    def _add_parameter_hook(self, model: Any, log_freq: int) -> None:
        """Add a forward hook that logs parameter statistics."""
        counter = _Counter(log_freq)

        def hook(module: Any, _input: Any, _output: Any) -> None:
            if not counter.tick():
                return
            metrics: dict[str, Any] = {}
            for name, parameter in module.named_parameters():
                stats = _tensor_stats(parameter)
                if stats is None:
                    continue
                prefix = f"parameters/{module.__class__.__name__}.{name}"
                for stat_name, value in stats.items():
                    metrics[f"{prefix}/{stat_name}"] = value
            if metrics:
                self._log_callback(metrics)

        handle = model.register_forward_hook(hook)
        self._handles.append(handle)

    def _add_gradient_hooks(self, model: Any, log_freq: int) -> None:
        """Add backward hooks on parameters that log gradient statistics."""
        counters: dict[str, _Counter] = {}

        for name, parameter in model.named_parameters():
            if not parameter.requires_grad:
                continue
            counters[name] = _Counter(log_freq)

            def make_hook(param_name: str) -> Callable[[Any], None]:
                counter = counters[param_name]

                def hook(grad: Any) -> None:
                    if not counter.tick():
                        return
                    stats = _tensor_stats(grad)
                    if stats is None:
                        return
                    prefix = f"gradients/{model.__class__.__name__}.{param_name}"
                    metrics = {f"{prefix}/{stat_name}": value for stat_name, value in stats.items()}
                    if metrics:
                        self._log_callback(metrics)

                return hook

            handle = parameter.register_hook(make_hook(name))
            self._handles.append(handle)
