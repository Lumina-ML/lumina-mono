/**
 * Shape of structured evaluation payloads the dashboard can visualize.
 * The eval pipeline writes these into Evaluation.summary (via
 * lumina.log_eval_summary); when absent the widgets show an empty state
 * rather than synthesizing data.
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