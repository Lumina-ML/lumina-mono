"""Global run context for the simplified Lumina backend path."""

from typing import Any, Optional


class _RunContext:
    def __init__(self):
        self.run_id: Optional[str] = None
        self.project: Optional[str] = None
        self.name: Optional[str] = None
        self.sweep_id: Optional[str] = None
        self.eval_id: Optional[str] = None
        self.config: dict[str, Any] = {}
        self.step: int = 0


_RUN_CONTEXT = _RunContext()


def get_run_context() -> _RunContext:
    return _RUN_CONTEXT


def reset_run_context() -> None:
    global _RUN_CONTEXT
    _RUN_CONTEXT = _RunContext()
