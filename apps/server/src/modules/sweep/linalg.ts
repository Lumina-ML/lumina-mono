/**
 * Tiny pure-TypeScript linear-algebra helpers used by the in-process
 * Gaussian Process Bayesian optimizer. The GP is bounded to <= 30
 * observations (we down-sample if more) so O(N^3) Cholesky-free direct
 * inversion is plenty fast.
 */

export type Matrix = number[][];
export type Vector = number[];

export function zeros(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
}

export function identity(n: number): Matrix {
  const m = zeros(n, n);
  for (let i = 0; i < n; i++) m[i][i] = 1;
  return m;
}

export function transpose(a: Matrix): Matrix {
  const rows = a.length;
  const cols = a[0].length;
  const out = zeros(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[j][i] = a[i][j];
    }
  }
  return out;
}

export function matmul(a: Matrix, b: Matrix): Matrix {
  const m = a.length;
  const k = a[0].length;
  const n = b[0].length;
  const out = zeros(m, n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let p = 0; p < k; p++) sum += a[i][p] * b[p][j];
      out[i][j] = sum;
    }
  }
  return out;
}

export function matvec(a: Matrix, v: Vector): Vector {
  const m = a.length;
  const n = a[0].length;
  const out = new Array<number>(m).fill(0);
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += a[i][j] * v[j];
    out[i] = sum;
  }
  return out;
}

/** Invert a symmetric positive-definite matrix via Gauss-Jordan elimination
 * with partial pivoting. Adds a small jitter for numerical safety. */
export function invertSymmetric(a: Matrix, jitter = 1e-6): Matrix {
  const n = a.length;
  // Copy + jitter
  const m: Matrix = a.map((row, i) => row.slice());
  for (let i = 0; i < n; i++) m[i][i] += jitter;
  const inv = identity(n);
  for (let i = 0; i < n; i++) {
    // Pivot
    let pivot = i;
    let maxVal = Math.abs(m[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(m[k][i]) > maxVal) {
        maxVal = Math.abs(m[k][i]);
        pivot = k;
      }
    }
    if (maxVal < 1e-12) {
      throw new Error("Matrix is singular; cannot invert");
    }
    if (pivot !== i) {
      [m[i], m[pivot]] = [m[pivot], m[i]];
      [inv[i], inv[pivot]] = [inv[pivot], inv[i]];
    }
    // Eliminate
    const diag = m[i][i];
    for (let j = 0; j < n; j++) {
      m[i][j] /= diag;
      inv[i][j] /= diag;
    }
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = m[k][i];
      if (factor === 0) continue;
      for (let j = 0; j < n; j++) {
        m[k][j] -= factor * m[i][j];
        inv[k][j] -= factor * inv[i][j];
      }
    }
  }
  return inv;
}

export function dot(a: Vector, b: Vector): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function norm(a: Vector): number {
  return Math.sqrt(dot(a, a));
}