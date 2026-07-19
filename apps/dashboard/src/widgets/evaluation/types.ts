/**
 * Shape of structured evaluation payloads the dashboard can visualize.
 * The backend may write these into Evaluation.summary; otherwise the
 * widgets synthesize them from the recorded scalar metrics.
 */

export interface ConfusionMatrix {
  /** Row = actual, column = predicted. */
  labels: string[];
  matrix: number[][];
}

export interface PRPoint {
  recall: number;
  precision: number;
}

export interface ThresholdSample {
  threshold: number;
  f1: number;
  precision: number;
  recall: number;
}