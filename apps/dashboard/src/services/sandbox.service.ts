import { fetchApi } from "./api";

/**
 * Scenario names accepted by `POST /api/v1/sandbox/run-example`.
 * Mirrors `apps/server/src/modules/sandbox/schema.ts#DemoScenarioSchema`.
 */
export type DemoScenario =
  | "basic"
  | "sweep"
  | "evaluation"
  | "trace"
  | "artifacts";

export interface DemoRunResult {
  scenario: DemoScenario;
  projectId: string;
  /** Head resource id (deep-link target). */
  targetId: string;
  /** What the head resource is — for frontend route building. */
  targetKind: "run" | "sweep" | "evaluation" | "trace" | "artifact";
  /** Human-readable summary shown in the success toast. */
  summary: string;
}

export interface DemoResetResult {
  deleted: {
    runs: number;
    sweeps: number;
    evaluations: number;
    traces: number;
    artifacts: number;
  };
}

export const SandboxService = {
  /** Trigger a demo scenario. Returns the deep-link target. */
  runExample(scenario: DemoScenario): Promise<DemoRunResult> {
    return fetchApi("/api/v1/sandbox/run-example", {
      method: "POST",
      body: { scenario },
    });
  },

  /** Wipe everything under `projectId` (used by the "Reset demo data" button). */
  resetDemo(projectId: string): Promise<DemoResetResult> {
    return fetchApi("/api/v1/sandbox/reset-demo", {
      method: "POST",
      body: { projectId },
    });
  },
};