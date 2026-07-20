"""Auth & workspace scenarios: AW-1 ~ AW-2."""

from __future__ import annotations

import time

from lumina.backend.client import LuminaClient, LuminaClientError

from _common import Timer, check_server, ensure_auth
from .base import Scenario, ScenarioResult


def _http_code(error: LuminaClientError) -> int | None:
    """Extract the HTTP status code from a LuminaClientError message."""
    prefix = "HTTP "
    msg = str(error)
    if not msg.startswith(prefix):
        return None
    code_part = msg[len(prefix) :].split(":", 1)[0]
    try:
        return int(code_part.split()[0])
    except (ValueError, IndexError):
        return None


class WorkspaceIsolationScenario(Scenario):
    """AW-1: workspace switching and cross-workspace isolation.

    Creates a run in the user's default workspace, verifies the same API key
    can read it when explicitly targeting that workspace, and verifies a
    request for an unrelated workspace is rejected.
    """

    scenario_id = "AW-1"
    name = "Workspace switching and isolation"

    def run(self) -> ScenarioResult:
        check_server()
        api_key = ensure_auth(prefix="aw1")
        if not api_key:
            return ScenarioResult(
                scenario_id=self.scenario_id,
                level=self.level,
                mode=self.mode,
                status="failed",
                error="Could not obtain an API key for the benchmark user",
            )

        # The server seeds a default workspace (id "default") but does not
        # auto-add new users to it. Add the benchmark user as a member so
        # explicit workspace selection works end-to-end.
        client = LuminaClient()
        user = client.get_current_user()
        default_workspace_id = "default"
        isolated_workspace_id = "isolated-workspace"

        client.create_workspace_membership(default_workspace_id, user["id"], role="member")

        project = "benchmark-auth"
        # Ensure project exists in the default workspace.
        default_client = LuminaClient(api_key=api_key, workspace_id=default_workspace_id)
        project_obj = default_client.get_project_by_name(project)
        if not project_obj:
            project_obj = default_client._request("POST", "/api/v1/projects", {"name": project})
        project_id = project_obj["id"]

        with Timer() as t:
            run = default_client.create_run(
                project=project,
                name=f"aw1-run-{int(time.time())}",
                config={"benchmark": True},
            )
        run_id = run["runId"]

        # Read from the default workspace explicitly: should succeed.
        default_client = LuminaClient(api_key=api_key, workspace_id=default_workspace_id)
        fetched = default_client.get_run(run_id)
        default_ok = fetched.get("runId") == run_id

        # Read from an isolated workspace: should be rejected because the
        # benchmark user is not a member of it.
        isolated_client = LuminaClient(api_key=api_key, workspace_id=isolated_workspace_id)
        isolated_code: int | None = None
        isolated_error: str | None = None
        try:
            isolated_client.get_run(run_id)
        except LuminaClientError as exc:
            isolated_error = str(exc)
            isolated_code = _http_code(exc)

        # The exact status may be 403 (forbidden) or 404 (not found) depending
        # on whether the server hides non-member workspaces; either means the
        # run was not exposed cross-workspace.
        isolated_blocked = isolated_code in (401, 403, 404)

        return ScenarioResult(
            scenario_id=self.scenario_id,
            level=self.level,
            mode=self.mode,
            status="passed" if default_ok and isolated_blocked else "failed",
            metrics={
                "default_workspace_id": default_workspace_id,
                "run_id": run_id,
                "create_elapsed_ms": round(t.elapsed * 1000, 2),
                "isolated_status_code": isolated_code,
            },
            assertions={
                "default_workspace_readable": default_ok,
                "isolated_workspace_blocked": isolated_blocked,
            },
            error=None if (default_ok and isolated_blocked) else isolated_error,
        )
