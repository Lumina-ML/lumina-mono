import type { ConfusionMatrix } from "./types";

/**
 * Pure aggregation helpers over a recorded confusion matrix. These compute
 * derived metrics (accuracy, per-class precision/recall/F1, macro averages)
 * from real data written into Evaluation.summary — nothing here synthesizes
 * data. When the eval pipeline hasn't recorded a matrix, callers should show
 * an empty state rather than fabricate one.
 */

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
    // row = actual = label, column = predicted.
    const tp = cm.matrix[i]![i]!;
    let fp = 0;
    let fn = 0;
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
