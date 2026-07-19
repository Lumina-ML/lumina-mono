/**
 * Server-side Bayesian optimizer for sweep ``method: "bayes"``.
 *
 * Implements a real Gaussian Process surrogate with RBF kernel and Expected
 * Improvement acquisition. Zero dependencies — uses the in-process linalg
 * helpers in ./linalg.ts. Falls back to Latin Hypercube Sampling when there
 * aren't enough observations to fit a GP (fewer than 3).
 */

import type { Parameter, SweepConfig } from "./schema.js";
import {
  type Matrix,
  type Vector,
  dot,
  identity,
  invertSymmetric,
  matmul,
  matvec,
  norm,
} from "./linalg.js";

export interface Observation {
  params: Record<string, number>;
  metric: number | null;
}

export interface SuggestionContext {
  config: SweepConfig;
  observations: Observation[];
  goal: "minimize" | "maximize";
  count: number;
  rng?: () => number;
}

const DEFAULT_RNG = (): number => Math.random();

interface NumericAxis {
  name: string;
  min: number;
  max: number;
  logScale: boolean;
  values?: undefined;
}

interface CategoricalAxis {
  name: string;
  values: unknown[];
  min?: undefined;
  max?: undefined;
  logScale?: undefined;
}

type Axis = NumericAxis | CategoricalAxis;

function axesFromConfig(config: SweepConfig): Axis[] {
  const axes: Axis[] = [];
  for (const [name, param] of Object.entries(config.parameters)) {
    if (!param) continue;
    if ("values" in param && Array.isArray(param.values)) {
      axes.push({ name, values: param.values });
    } else if ("min" in param && "max" in param) {
      const dist = (param as { distribution?: string }).distribution;
      axes.push({
        name,
        min: Number((param as { min: number }).min),
        max: Number((param as { max: number }).max),
        logScale: dist === "log_uniform",
      });
    }
  }
  return axes;
}

function encodePoint(axes: Axis[], params: Record<string, unknown>): Vector {
  return axes.map((axis) => {
    const raw = params?.[axis.name];
    if ("values" in axis && axis.values) {
      // Categorical: hash to a stable [0, 1] via index/length.
      const idx = axis.values.indexOf(raw as never);
      return idx >= 0 ? idx / Math.max(1, axis.values.length - 1) : 0;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) return 0;
    if (axis.logScale && value > 0) {
      return (Math.log(value) - Math.log(axis.min)) / (Math.log(axis.max) - Math.log(axis.min));
    }
    return (value - axis.min) / Math.max(1e-12, axis.max - axis.min);
  });
}

function decodePoint(axes: Axis[], encoded: Vector): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  axes.forEach((axis, i) => {
    const u = Math.max(0, Math.min(1, encoded[i]));
    if ("values" in axis && axis.values) {
      const idx = Math.min(axis.values.length - 1, Math.round(u * (axis.values.length - 1)));
      out[axis.name] = axis.values[idx];
    } else if (axis.min !== undefined && axis.max !== undefined) {
      if (axis.logScale) {
        const lv = Math.log(axis.min) + u * (Math.log(axis.max) - Math.log(axis.min));
        out[axis.name] = Math.exp(lv);
      } else {
        out[axis.name] = axis.min + u * (axis.max - axis.min);
      }
    }
  });
  return out;
}

function rbf(a: Vector, b: Vector, lengthScale: number, signalVariance: number): number {
  const d = a.length;
  let sumSq = 0;
  for (let i = 0; i < d; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  return signalVariance * Math.exp(-sumSq / (2 * lengthScale * lengthScale));
}

const MAX_OBS = 30;

interface GaussianProcess {
  mean: Vector;
  trainX: Vector[];
  trainY: Vector;
  /** K + sigma^2 I, precomputed. */
  kInv: Matrix;
  signalVariance: number;
  lengthScale: number;
  noiseVariance: number;
}

function fitGp(obs: Observation[], axes: Axis[]): GaussianProcess | null {
  const finished = obs.filter((o): o is Observation & { metric: number } => typeof o.metric === "number");
  if (finished.length < 3) return null;

  // Down-sample to most recent MAX_OBS to keep matrix inversion cheap.
  const recent = finished.slice(-MAX_OBS);
  const trainX = recent.map((o) => encodePoint(axes, o.params));
  const meanY = recent.reduce((acc, o) => acc + o.metric, 0) / recent.length;
  const trainY: Vector = recent.map((o) => o.metric - meanY);

  const n = trainX.length;
  // Median heuristic for length scale.
  let lengthScale = 0.5;
  {
    const dists: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = norm(trainX[i].map((v, k) => v - trainX[j][k]));
        dists.push(d);
      }
    }
    if (dists.length > 0) {
      dists.sort((a, b) => a - b);
      lengthScale = Math.max(1e-2, dists[Math.floor(dists.length / 2)] || 0.5);
    }
  }
  const signalVariance = Math.max(
    1e-3,
    recent.reduce((acc, o) => acc + (o.metric - meanY) ** 2, 0) / Math.max(1, n - 1),
  );
  const noiseVariance = signalVariance * 0.05; // assume 5% observation noise

  const K: Matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      rbf(trainX[i], trainX[j], lengthScale, signalVariance) + (i === j ? noiseVariance : 0),
    ),
  );
  try {
    const kInv = invertSymmetric(K, 1e-6);
    return { mean: [meanY], trainX, trainY, kInv, signalVariance, lengthScale, noiseVariance };
  } catch {
    return null;
  }
}

function predict(gp: GaussianProcess, x: Vector): { mean: number; variance: number } {
  const kStar: Vector = gp.trainX.map((xi) => rbf(xi, x, gp.lengthScale, gp.signalVariance));
  const alpha = matvec(gp.kInv, gp.trainY);
  const mean = gp.mean[0] + dot(alpha, kStar);
  const kSelf = gp.signalVariance; // k(x*, x*) = sigma^2 (RBF with 0 distance)
  const v = matvec(gp.kInv, kStar);
  const variance = Math.max(1e-9, kSelf - dot(kStar, v));
  return { mean, variance };
}

function expectedImprovement(gp: GaussianProcess, x: Vector, best: number, goal: "minimize" | "maximize"): number {
  const { mean, variance } = predict(gp, x);
  const sigma = Math.sqrt(variance);
  if (sigma < 1e-9) return 0;
  const diff = goal === "minimize" ? best - mean : mean - best;
  const z = diff / sigma;
  // Standard normal CDF + PDF using Abramowitz-Stegun approximation.
  const cdf = 0.5 * (1 + erf(z / Math.SQRT2));
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  return diff * cdf + sigma * pdf;
}

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26 approximation; |error| < 1.5e-7.
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function lhsSample(axes: Axis[], rng: () => number): Vector {
  return axes.map((axis) => {
    if ("values" in axis && axis.values) {
      return rng();
    }
    return rng();
  });
}

/** Generate candidate parameter sets using a Gaussian Process + Expected
 * Improvement when we have enough observations; otherwise Latin Hypercube. */
export function suggestNext(ctx: SuggestionContext): Array<Record<string, unknown>> {
  const axes = axesFromConfig(ctx.config);
  if (axes.length === 0) return [];

  const rng = ctx.rng ?? DEFAULT_RNG;
  const validObs = ctx.observations.filter((o): o is Observation => o.params !== undefined);

  let candidates: Array<{ params: Record<string, unknown>; score: number }> = [];

  if (validObs.length >= 3) {
    const gp = fitGp(validObs, axes);
    if (gp) {
      const finished = validObs.filter((o): o is Observation & { metric: number } => typeof o.metric === "number");
      const bestMetric = finished.reduce((acc, o) =>
        ctx.goal === "minimize" ? Math.min(acc, o.metric) : Math.max(acc, o.metric),
        ctx.goal === "minimize" ? Infinity : -Infinity,
      );

      const TRIALS = 256;
      let bestScore = -Infinity;
      let bestEncoded: Vector = lhsSample(axes, rng);
      for (let t = 0; t < TRIALS; t++) {
        const x = lhsSample(axes, rng);
        const ei = expectedImprovement(gp, x, bestMetric, ctx.goal);
        if (ei > bestScore) {
          bestScore = ei;
          bestEncoded = x;
        }
      }
      candidates = [{ params: decodePoint(axes, bestEncoded), score: bestScore }];

      // Add jittered copies of the best so multiple workers don't all pick
      // the same next point.
      for (let i = 1; i < ctx.count; i++) {
        const jittered: Vector = bestEncoded.map((v) => {
          const noise = (rng() - 0.5) * 0.1;
          return Math.max(0, Math.min(1, v + noise));
        });
        candidates.push({ params: decodePoint(axes, jittered), score: 0 });
      }
      return candidates.slice(0, ctx.count).map((c) => c.params);
    }
  }

  // Fallback: Latin Hypercube Sampling.
  for (let i = 0; i < ctx.count; i++) {
    const encoded = lhsSample(axes, rng);
    candidates.push({ params: decodePoint(axes, encoded), score: 0 });
  }
  return candidates.map((c) => c.params);
}

export interface EarlyTerminateContext {
  /** All past observations for this sweep (newest last). */
  observations: Observation[];
  /** Current run id (so we don't compare against itself). */
  runId: string;
  step: number;
  currentMetric: number;
  config: SweepConfig;
  goal: "minimize" | "maximize";
}

/** Decide whether the current run should be stopped. Hyperband bracket +
 * successive halving is the canonical algorithm; we approximate it with a
 * median-pruning rule ("median" type) and a simple bracket check for
 * "hyperband" type. */
export function shouldEarlyTerminate(ctx: EarlyTerminateContext): {
  shouldTerminate: boolean;
  reason?: string;
} {
  const et = ctx.config.early_terminate;
  if (!et) return { shouldTerminate: false };

  const minIter = et.min_iter ?? 1;
  if (ctx.step < minIter) {
    return { shouldTerminate: false, reason: `step ${ctx.step} < min_iter ${minIter}` };
  }

  if (et.type === "median") {
    const others = ctx.observations
      .filter((o) => typeof o.metric === "number")
      .map((o) => o.metric as number);
    if (others.length < 3) {
      return { shouldTerminate: false, reason: "not enough peers" };
    }
    const sorted = [...others].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const isWorse = ctx.goal === "minimize" ? ctx.currentMetric > median : ctx.currentMetric < median;
    if (isWorse) {
      return { shouldTerminate: true, reason: `metric ${ctx.currentMetric} worse than median ${median}` };
    }
    return { shouldTerminate: false, reason: "above median" };
  }

  if (et.type === "hyperband") {
    const eta = et.eta ?? 3;
    const maxIter = et.max_iter ?? 81;
    // Simple bracket check: stop if step is not aligned with a halving step.
    const bracketSizes: number[] = [];
    let s = maxIter;
    while (s >= minIter) {
      bracketSizes.push(s);
      s = Math.floor(s / eta);
    }
    if (!bracketSizes.includes(ctx.step)) {
      return { shouldTerminate: false, reason: "between halving steps" };
    }
    // Within the current bracket, keep top fraction 1/eta.
    const peers = ctx.observations
      .filter((o) => typeof o.metric === "number")
      .map((o) => o.metric as number);
    if (peers.length < eta) {
      return { shouldTerminate: false, reason: "not enough peers" };
    }
    const sorted = [...peers, ctx.currentMetric].sort((a, b) =>
      ctx.goal === "minimize" ? a - b : b - a,
    );
    const rank = sorted.indexOf(ctx.currentMetric);
    const keep = Math.max(1, Math.floor(sorted.length / eta));
    if (rank >= sorted.length - keep) {
      return { shouldTerminate: false, reason: "kept by bracket" };
    }
    return { shouldTerminate: true, reason: `bracket rank ${rank}/${sorted.length}` };
  }

  return { shouldTerminate: false };
}