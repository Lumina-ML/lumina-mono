/**
 * In-process demo scenario runners (Roadmap §MVP-2 / M1-5).
 *
 * Each runner writes a small, opinionated chunk of mock data into the
 * pre-seeded `__demo__` project and returns the id of the head resource
 * the dashboard should deep-link to. No real ML happens here — the
 * point is to give new users something visually convincing to click on
 * within seconds of landing on the workspace overview.
 *
 * Conventions:
 *   - All writes go through the project's repository classes (not raw
 *     prisma) so domain events / audit logs / cascade deletes stay
 *     consistent with the real API surface.
 *   - Runners are idempotent in spirit (re-running replaces the demo
 *     with a fresh copy) but the "Reset demo data" button calls
 *     `purgeDemoProject` first to clear prior runs.
 *   - Generated ids (runId / sweepId / etc.) are stable UUID v7s from
 *     `shared/uuid7.ts` so URLs stay valid across reloads.
 */

import type { PrismaClient } from "../../generated/prisma/index.js";
import type { TraceStorage } from "../../core/storage/trace-storage.js";
import { RunRepository } from "../run/repository.js";
import { SweepRepository } from "../sweep/repository.js";
import { TraceRepository } from "../trace/repository.js";
import { ArtifactRepository } from "../artifact/repository.js";
import { EvaluationRepository } from "../evaluation/repository.js";
import { MetricRepository } from "../metric/repository.js";
import { uuidv7 } from "../../shared/uuid7.js";

// ── Public types ──────────────────────────────────────────────────────

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

export interface DemoRunnersContext {
  prisma: PrismaClient;
  traceStorage: TraceStorage;
}

// ── Entry point ──────────────────────────────────────────────────────

const RUNNERS: Record<DemoScenario, (p: string, ctx: DemoRunnersContext) => Promise<DemoRunResult>> = {
  basic: runBasic,
  sweep: runSweep,
  evaluation: runEvaluation,
  trace: runTrace,
  artifacts: runArtifacts,
};

export async function runDemoScenario(
  scenario: DemoScenario,
  projectId: string,
  ctx: DemoRunnersContext,
): Promise<DemoRunResult> {
  const runner = RUNNERS[scenario];
  if (!runner) {
    throw new Error(`Unknown demo scenario: ${scenario}`);
  }
  return runner(projectId, ctx);
}

// ── Reset ─────────────────────────────────────────────────────────────

/**
 * Wipe everything the demo runners have ever produced under
 * `projectId`. Used by the "Reset demo data" button. Cascade deletes
 * in the Prisma schema handle sweeps/evals/traces/artifacts that link
 * to runs.
 */
export async function purgeDemoProject(
  projectId: string,
  prisma: PrismaClient,
): Promise<{ deleted: { runs: number; sweeps: number; evaluations: number; traces: number; artifacts: number } }> {
  const [runs, sweeps, evaluations, artifacts] = await Promise.all([
    prisma.run.deleteMany({ where: { projectId } }),
    prisma.sweep.deleteMany({ where: { projectId } }),
    prisma.evaluation.deleteMany({ where: { projectId } }),
    prisma.artifact.deleteMany({ where: { projectId } }),
  ]);
  // Traces live in the storage backend, not Prisma — call its deleteAll
  // hook if it has one. PrismaTraceStorage cascades via Spans; for now
  // traces are recreated on every demo run, so we just leave them.
  return {
    deleted: {
      runs: runs.count,
      sweeps: sweeps.count,
      evaluations: evaluations.count,
      traces: 0,
      artifacts: artifacts.count,
    },
  };
}

// ── Runners ──────────────────────────────────────────────────────────

/**
 * Basic: 3 runs with realistic-looking training curves.
 * Deep-links to the first run.
 */
async function runBasic(projectId: string, ctx: DemoRunnersContext): Promise<DemoRunResult> {
  const runs = new RunRepository(ctx.prisma);

  const configs = [
    { name: "baseline-resnet50", config: { lr: 0.001, batch_size: 64, epochs: 10 } },
    { name: "wide-resnet",      config: { lr: 0.0005, batch_size: 32, epochs: 10 } },
    { name: "deep-resnet",      config: { lr: 0.002, batch_size: 128, epochs: 10 } },
  ];

  const created = [];
  for (const c of configs) {
    const r = await runs.create(projectId, {
      project: c.name,
      name: c.name,
      config: c.config,
      metadata: { demo: true, scenario: "basic" },
    });
    created.push(r);
  }

  // Seed 30 steps of loss / accuracy for each run.
  const series: Array<{ runId: string; projectId: string; key: string; step: number; value: number }> = [];
  for (const run of created) {
    const lr = (run.config as { lr?: number }).lr ?? 0.001;
    const accValues: number[] = [];
    for (let step = 0; step < 30; step++) {
      const loss = 2.5 * Math.exp(-step / 12) + (Math.random() - 0.5) * 0.05 + lr * 100;
      const acc = Math.min(0.98, 0.3 + step * 0.022 + Math.random() * 0.01);
      const accRounded = Number(acc.toFixed(4));
      accValues.push(accRounded);
      series.push({ runId: run.runId, projectId, key: "loss", step, value: Number(loss.toFixed(4)) });
      series.push({ runId: run.runId, projectId, key: "accuracy", step, value: accRounded });
    }
    // Mark finished + write a summary so the run detail page has a hero value.
    await ctx.prisma.run.update({
      where: { runId: run.runId },
      data: {
        status: "finished",
        finishedAt: new Date(),
        summary: { accuracy: accValues[accValues.length - 1] ?? 0 },
      },
    });
  }
  await ctx.prisma.metric.createMany({ data: series });

  return {
    scenario: "basic",
    projectId,
    targetId: created[0].runId,
    targetKind: "run",
    summary: `Created ${created.length} runs with loss/accuracy curves.`,
  };
}

/**
 * Sweep: 1 sweep + 4 trial runs. Trial runs share the sweep id and
 * get randomized loss curves.
 */
async function runSweep(projectId: string, ctx: DemoRunnersContext): Promise<DemoRunResult> {
  const runs = new RunRepository(ctx.prisma);
  const sweeps = new SweepRepository(ctx.prisma);

  const sweep = await sweeps.create(projectId, {
    name: "lr-batch-sweep",
    method: "random",
    config: {
      parameters: {
        lr: { min: 0.0001, max: 0.01, distribution: "log_uniform" },
        batch_size: { values: [16, 32, 64, 128] },
      },
      metric: { name: "loss", goal: "minimize" },
    },
  });

  const trials = [];
  for (let i = 0; i < 4; i++) {
    const trial = await runs.create(projectId, {
      project: `sweep-trial-${i + 1}`,
      name: `trial-${i + 1}`,
      sweepId: sweep.id,
      config: {
        lr: 0.001 * Math.pow(2, i),
        batch_size: [16, 32, 64, 128][i],
      },
      metadata: { demo: true, scenario: "sweep", trialIndex: i },
    });
    const series: Array<{ runId: string; projectId: string; key: string; step: number; value: number }> = [];
    for (let step = 0; step < 20; step++) {
      const loss = 1.5 * Math.exp(-step / (5 + i)) + 0.1 + Math.random() * 0.05;
      series.push({ runId: trial.runId, projectId, key: "loss", step, value: Number(loss.toFixed(4)) });
    }
    await ctx.prisma.metric.createMany({ data: series });
    const finalLoss = series[series.length - 1].value;
    await ctx.prisma.run.update({
      where: { runId: trial.runId },
      data: {
        status: "finished",
        finishedAt: new Date(),
        summary: { loss: finalLoss },
      },
    });
    trials.push({ trial, finalLoss });
  }

  // Pick the trial with the lowest final loss as bestRun.
  const best = trials.reduce((a, b) => (a.finalLoss < b.finalLoss ? a : b));
  await ctx.prisma.sweep.update({
    where: { id: sweep.id },
    data: { bestRunId: best.trial.runId, state: "finished" },
  });

  return {
    scenario: "sweep",
    projectId,
    targetId: sweep.id,
    targetKind: "sweep",
    summary: `Created sweep with ${trials.length} trial runs.`,
  };
}

/**
 * Evaluation: 1 evaluation + 5 results + 2 artifacts (dataset + model).
 * Deep-links to the evaluation.
 */
async function runEvaluation(projectId: string, ctx: DemoRunnersContext): Promise<DemoRunResult> {
  const evaluations = new EvaluationRepository(ctx.prisma);
  const artifacts = new ArtifactRepository(ctx.prisma);

  // Seed dataset + model artifacts so the evaluation has something to
  // reference (avoids a FK error on the linking columns).
  const dataset = await artifacts.createArtifact(projectId, {
    name: "demo-dataset",
    type: "dataset",
    description: "200 image classification samples (cat / dog).",
  });
  const datasetVersion = await artifacts.createVersion(dataset.id, {
    version: "v1",
    aliases: ["latest"],
    metadata: {},
  });

  const model = await artifacts.createArtifact(projectId, {
    name: "demo-classifier",
    type: "model",
    description: "ResNet-50 fine-tuned on the demo dataset.",
  });
  const modelVersion = await artifacts.createVersion(model.id, {
    version: "v1",
    aliases: ["latest"],
    metadata: {},
  });

  const evaluation = await evaluations.createEvaluation(projectId, {
    name: "demo-evaluation",
    datasetArtifactVersionId: datasetVersion.id,
    modelArtifactVersionId: modelVersion.id,
    metadata: { framework: "pytorch", dataset: "demo-dataset", model: "demo-classifier" },
  });

  const results = [
    { key: "accuracy", value: 0.92 },
    { key: "f1", value: 0.91 },
    { key: "precision", value: 0.93 },
    { key: "recall", value: 0.90 },
    { key: "auc", value: 0.96 },
  ];
  for (const r of results) {
    await evaluations.createResult(evaluation.id, {
      key: r.key,
      value: r.value,
      metadata: {},
    });
  }

  // EvaluationRepository doesn't expose a generic update — patch via
  // prisma directly so the dashboard sees a "completed" status.
  await ctx.prisma.evaluation.update({
    where: { id: evaluation.id },
    data: {
      status: "completed",
      summary: { accuracy: 0.92, f1: 0.91 },
    },
  });

  return {
    scenario: "evaluation",
    projectId,
    targetId: evaluation.id,
    targetKind: "evaluation",
    summary: `Created evaluation with ${results.length} metrics.`,
  };
}

/**
 * Trace: 1 trace with 5 spans arranged as a small agent graph.
 */
async function runTrace(projectId: string, ctx: DemoRunnersContext): Promise<DemoRunResult> {
  const traces = new TraceRepository(ctx.traceStorage);

  const traceId = uuidv7();
  await traces.createTrace(projectId, {
    traceId,
    name: "chat-completion",
    metadata: { model: "gpt-4", user_query: "demo" },
  });

  const rootSpanId = uuidv7();
  await traces.createSpan(traceId, {
    spanId: rootSpanId,
    name: "chat-completion",
    kind: "agent",
    input: { messages: [{ role: "user", content: "demo query" }] },
    output: { ok: true },
    status: "ok",
  });

  const spans: Array<{ name: string; kind: "llm" | "tool" | "retriever" | "chain" | "agent" | "internal"; latencyMs: number }> = [
    { name: "retrieve-context", kind: "retriever", latencyMs: 80 },
    { name: "llm-call",         kind: "llm",       latencyMs: 420 },
    { name: "tool-call",        kind: "tool",      latencyMs: 35 },
    { name: "format-response",  kind: "internal",  latencyMs: 12 },
    { name: "post-trace-hook",  kind: "internal",  latencyMs: 5 },
  ];
  for (const s of spans) {
    const spanId = uuidv7();
    await traces.createSpan(traceId, {
      spanId,
      parentSpanId: rootSpanId,
      name: s.name,
      kind: s.kind,
      input: { demo: true },
      output: { ok: true },
      status: "ok",
    });
    await traces.updateSpan(spanId, {
      latencyMs: s.latencyMs,
      finishedAt: new Date(Date.now() - s.latencyMs),
    });
  }

  const totalLatency = spans.reduce((sum, s) => sum + s.latencyMs, 0);
  await traces.updateTrace(traceId, {
    finishedAt: new Date(),
    latencyMs: totalLatency,
    status: "ok",
  });

  return {
    scenario: "trace",
    projectId,
    targetId: traceId,
    targetKind: "trace",
    summary: `Created trace with ${spans.length} spans.`,
  };
}

/**
 * Artifacts: 1 artifact (model), 2 versions, 1 file per version.
 */
async function runArtifacts(projectId: string, ctx: DemoRunnersContext): Promise<DemoRunResult> {
  const artifacts = new ArtifactRepository(ctx.prisma);

  const artifact = await artifacts.createArtifact(projectId, {
    name: "example-model",
    type: "model",
    description: "Demo model artifact with two versions.",
  });

  for (const [version, accuracy] of [["v1", 0.86], ["v2", 0.92]] as const) {
    const v = await artifacts.createVersion(artifact.id, {
      version,
      aliases: version === "v2" ? ["latest"] : [],
      metadata: { accuracy },
    });
    await ctx.prisma.artifactFile.create({
      data: {
        artifactVersionId: v.id,
        path: `model-${version}.pt`,
        contentType: "application/octet-stream",
        size: BigInt(1024 * (version === "v2" ? 512 : 256)),
        storageKey: `demo/${artifact.id}/${version}/model-${version}.pt`,
      },
    });
  }

  return {
    scenario: "artifacts",
    projectId,
    targetId: artifact.id,
    targetKind: "artifact",
    summary: `Created artifact with 2 versions.`,
  };
}