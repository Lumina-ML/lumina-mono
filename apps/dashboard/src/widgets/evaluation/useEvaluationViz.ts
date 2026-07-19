import type { ConfusionMatrix, PRPoint, ThresholdSample } from "./types";

/**
 * Synthetic evaluation data for the dashboard's visualizations. The backend's
 * Evaluation.summary may carry a structured payload — when it does, callers
 * should prefer that. This module produces a coherent fallback so the
 * dashboard is functional even before the evaluation pipeline writes the
 * full confusion matrix / PR samples.
 */

function rng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const DEFAULT_LABELS = ["cat", "dog", "bird", "fish"];

export function syntheticConfusionMatrix(
  numSamples: number,
  accuracy: number,
  labels: string[] = DEFAULT_LABELS,
): ConfusionMatrix {
  const rand = rng(numSamples + Math.round(accuracy * 1000));
  const matrix: number[][] = labels.map(() => labels.map(() => 0));
  const perClass = Math.round(numSamples / labels.length);
  for (let i = 0; i < labels.length; i++) {
    for (let k = 0; k < perClass; k++) {
      // Per-class accuracy is jittered around the global accuracy.
      const correct = rand() < accuracy;
      if (correct) {
        matrix[i]![i]! += 1;
      } else {
        // Distribute misses uniformly across the other classes.
        const off = (i + 1 + Math.floor(rand() * (labels.length - 1))) % labels.length;
        matrix[i]![off]! += 1;
      }
    }
  }
  return { labels, matrix };
}

export function syntheticPRCurve(
  numPoints: number,
  aucHint: number,
): PRPoint[] {
  const rand = rng(Math.round(aucHint * 1000) + numPoints);
  const points: PRPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const recall = i / numPoints;
    // Curve starts at (0, 1), drops to roughly (1, aucHint).
    const noise = (rand() - 0.5) * 0.05;
    const precision = Math.max(
      0,
      Math.min(1, 1 - (1 - aucHint) * recall + noise),
    );
    points.push({ recall, precision });
  }
  return points;
}

export function syntheticThresholdSamples(
  numPoints: number,
  aucHint: number,
): ThresholdSample[] {
  const rand = rng(7);
  const samples: ThresholdSample[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const threshold = i / numPoints;
    // F1 typically peaks around the sweet spot.
    const peak = 0.5;
    const distance = Math.abs(threshold - peak);
    const base = aucHint * (1 - distance * 0.7);
    const f1 = Math.max(0, Math.min(1, base + (rand() - 0.5) * 0.05));
    const precision = Math.max(0, Math.min(1, f1 + (rand() - 0.5) * 0.1));
    const recall = Math.max(0, Math.min(1, f1 * 1.2 - (rand() - 0.5) * 0.05));
    samples.push({ threshold, f1, precision, recall });
  }
  return samples;
}

/** Aggregate the per-cell counts into row totals and accuracy. */
export function confusionMatrixStats(cm: ConfusionMatrix) {
  const n = cm.matrix.reduce(
    (s, row) => s + row.reduce((a, b) => a + b, 0),
    0,
  );
  let correct = 0;
  for (let i = 0; i < cm.labels.length; i++) {
    correct += cm.matrix[i]![i]!;
  }
  const accuracy = n > 0 ? correct / n : 0;
  return { total: n, correct, accuracy };
}

/** Compute per-class precision/recall/F1 from a confusion matrix. */
export function perClassMetrics(cm: ConfusionMatrix): Array<{
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}> {
  const n = cm.labels.length;
  return cm.labels.map((label, i) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (let j = 0; j < n; j++) {
      tp += cm.matrix[i]![j]!; // row = actual = label
      fp += cm.matrix[j]![i]! - (i === j ? cm.matrix[i]![i]! : 0);
      fn += cm.matrix[i]![j]! - (i === j ? cm.matrix[i]![i]! : 0);
    }
    // The above double-subtracts the diagonal — recompute cleanly.
    tp = cm.matrix[i]![i]!;
    fp = 0;
    fn = 0;
    for (let j = 0; j < n; j++) {
      if (j !== i) fp += cm.matrix[j]![i]!;
      if (j !== i) fn += cm.matrix[i]![j]!;
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 =
      precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    const support = cm.matrix[i]!.reduce((a, b) => a + b, 0);
    return { label, precision, recall, f1, support };
  });
}

/** Macro-averaged precision/recall/F1 over all classes. */
export function macroAverages(cm: ConfusionMatrix) {
  const m = perClassMetrics(cm);
  const n = m.length || 1;
  return {
    precision: m.reduce((a, x) => a + x.precision, 0) / n,
    recall: m.reduce((a, x) => a + x.recall, 0) / n,
    f1: m.reduce((a, x) => a + x.f1, 0) / n,
  };
}