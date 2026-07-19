/**
 * Deterministic run color — same runId always maps to the same color so the
 * user can track a run across views (table, selector, chart, detail page).
 *
 * Palette is MLflow's 29-color RUNS_COLOR_PALETTE. The hash is a 32-bit FNV-1a
 * so it stays stable across browsers and sessions.
 */

const PALETTE: readonly string[] = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
  "#0ea5e9", "#f43f5e", "#10b981", "#a855f7", "#f59e0b",
  "#06b6d4", "#ec4899", "#84cc16", "#3b82f6", "#ef4444",
  "#8b5cf6", "#14b8a6", "#f97316", "#22c55e", "#eab308",
  "#6366f1", "#facc15", "#fb7185", "#94a3b8",
];

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

export function colorForRunId(runId: string): string {
  if (!runId) return PALETTE[0]!;
  return PALETTE[fnv1a(runId) % PALETTE.length]!;
}

export const RUN_COLOR_PALETTE = PALETTE;