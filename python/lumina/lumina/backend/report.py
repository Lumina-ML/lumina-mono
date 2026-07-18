"""Minimal Report support for the Lumina backend path."""

from __future__ import annotations

from typing import Any, Optional

from lumina.backend.client import LuminaClient
from lumina.backend.run_context import get_run_context


class LuminaReport:
    """A lightweight report for the Lumina backend."""

    def __init__(
        self,
        title: str,
        blocks: Optional[list[dict[str, Any]]] = None,
        created_by: Optional[str] = None,
        project: Optional[str] = None,
    ):
        self.title = title
        self.blocks = blocks or []
        self.created_by = created_by
        self.project = project
        self._report_id: Optional[str] = None
        self._client = LuminaClient()

    def add_block(self, block: dict[str, Any]) -> "LuminaReport":
        """Append a block to the report."""
        self.blocks.append(block)
        return self

    def add_text(self, text: str) -> "LuminaReport":
        """Append a text block."""
        self.blocks.append({"type": "text", "text": text})
        return self

    def add_metric(self, key: str, value: float, step: Optional[int] = None) -> "LuminaReport":
        """Append a metric block."""
        block: dict[str, Any] = {"type": "metric", "key": key, "value": value}
        if step is not None:
            block["step"] = step
        self.blocks.append(block)
        return self

    def add_run_gallery(self, run_ids: list[str]) -> "LuminaReport":
        """Append a run gallery block."""
        self.blocks.append({"type": "run_gallery", "runIds": run_ids})
        return self

    def save(self) -> dict[str, Any]:
        """Create or update the report on the Lumina backend."""
        ctx = get_run_context()
        project_name = self.project or ctx.project
        if not project_name:
            raise ValueError("project is required when no run context exists")

        project_obj = self._client.get_project_by_name(project_name)
        if not project_obj:
            project_obj = self._client._request("POST", "/api/v1/projects", {"name": project_name})
        project_id = project_obj["id"]

        if self._report_id:
            return self._client.patch_report(
                self._report_id,
                title=self.title,
                blocks=self.blocks,
                created_by=self.created_by,
            )

        report = self._client.create_report(
            project_id,
            self.title,
            blocks=self.blocks,
            created_by=self.created_by,
        )
        self._report_id = report["id"]
        return report

    def refresh(self) -> dict[str, Any]:
        """Fetch the latest report state from the backend."""
        if not self._report_id:
            raise ValueError("Report has not been saved yet")
        return self._client.get_report(self._report_id)
