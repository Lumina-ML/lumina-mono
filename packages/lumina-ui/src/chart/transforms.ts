/**
 * 纯数据变换工具，用于把后端/前端收集到的 metric 点数据转换成
 * `ChartConfig` / `ChartSeries` 可直接消费的形态。
 *
 * 设计原则：
 * - 与渲染库无关（不依赖 ECharts 内部类型）。
 * - 所有函数都是纯函数，便于单元测试和跨组件复用。
 * - 输入输出类型与 `chart/types.ts` 解耦，避免循环依赖。
 */

export interface MetricPoint {
  step: number;
  value: number;
  loggedAt?: string | number | Date;
}

export interface MetricSeries {
  name: string;
  /** 原始 metric key，如 "train/loss" */
  key?: string;
  runId?: string;
  color?: string;
  data: MetricPoint[];
  /** 渲染时可选的线宽，供聚合 band 使用 */
  lineWidth?: number;
  /** 渲染时可选的面积透明度 */
  areaOpacity?: number;
}

export type SmoothMethod = "movingAverage" | "exponential";

export type XAxisMode = "step" | "wall" | "relative" | "metric";

export interface MapXAxisOptions {
  /**
   * wall / relative 模式的基准时间（ms）。
   * 未指定时 relative 会自动取所有点的最小 loggedAt。
   */
  baseTime?: number;
  /**
   * metric 模式下，step -> 另一 metric x 值的映射。
   * 如果某个 step 缺失，则跳过该点。
   */
  metricByStep?: Record<number, number>;
}

export type AggregationMethod = "min" | "max" | "mean";

export interface AggregatedBand {
  x: number;
  min: number;
  max: number;
  mean: number;
  std: number;
  count: number;
}

// ── Smoothing ───────────────────────────────────────────────────────────

/**
 * 对时序做平滑。
 *
 * - `movingAverage`：窗口为 `smoothing` 的 trailing 移动平均。
 * - `exponential`：`alpha = smoothing / (smoothing + 1)` 的指数平滑。
 *
 * 当 smoothing <= 0 时直接返回原数组（浅拷贝）。
 */
export function smoothSeries(
  points: MetricPoint[],
  smoothing: number,
  method: SmoothMethod = "movingAverage",
): MetricPoint[] {
  if (points.length === 0 || smoothing <= 0) return points.slice();

  if (method === "exponential") {
    const alpha = smoothing / (smoothing + 1);
    let prev = points[0]!.value;
    return points.map((p, idx) => {
      const value = idx === 0 ? prev : alpha * p.value + (1 - alpha) * prev;
      prev = value;
      return { ...p, value };
    });
  }

  const window = Math.max(1, Math.floor(smoothing));
  const out: MetricPoint[] = [];
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i]!.value;
    if (i >= window) sum -= points[i - window]!.value;
    const count = Math.min(window, i + 1);
    out.push({ ...points[i]!, value: sum / count });
  }
  return out;
}

// ── Outlier clipping ────────────────────────────────────────────────────

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 >= sorted.length) return sorted[base]!;
  return sorted[base]! + rest * (sorted[base + 1]! - sorted[base]!);
}

/**
 * 把超出 `[lowerPercentile, upperPercentile]` 分位数的值裁剪到边界。
 * 默认使用 1st / 99th 百分位。
 */
export function clipOutliers(
  points: MetricPoint[],
  lowerPercentile = 0.01,
  upperPercentile = 0.99,
): MetricPoint[] {
  if (points.length === 0) return [];
  const sorted = points.map((p) => p.value).slice().sort((a, b) => a - b);
  const lower = quantile(sorted, lowerPercentile);
  const upper = quantile(sorted, upperPercentile);
  return points.map((p) => ({
    ...p,
    value: Math.min(upper, Math.max(lower, p.value)),
  }));
}

// ── X axis mapping ──────────────────────────────────────────────────────

function toTimestamp(loggedAt: NonNullable<MetricPoint["loggedAt"]>): number {
  if (typeof loggedAt === "number") return loggedAt;
  if (loggedAt instanceof Date) return loggedAt.getTime();
  return Date.parse(loggedAt);
}

/**
 * 把 `MetricPoint[]` 映射成 `[x, y]` 坐标数组，供 `ChartSeries.data` 使用。
 */
export function mapXAxis(
  points: MetricPoint[],
  mode: XAxisMode,
  options: MapXAxisOptions = {},
): Array<[number | string, number]> {
  if (points.length === 0) return [];

  switch (mode) {
    case "step":
      return points.map((p) => [p.step, p.value] as [number, number]);

    case "wall": {
      return points.map((p) => {
        const x = p.loggedAt != null ? toTimestamp(p.loggedAt) : p.step;
        return [x, p.value] as [number, number];
      });
    }

    case "relative": {
      const tss = points.map((p) =>
        p.loggedAt != null ? toTimestamp(p.loggedAt) : p.step,
      );
      const base = options.baseTime ?? Math.min(...tss);
      return points.map((p, idx) => [tss[idx]! - base, p.value] as [number, number]);
    }

    case "metric": {
      const map = options.metricByStep ?? {};
      return points
        .filter((p) => map[p.step] != null)
        .map((p) => [map[p.step]!, p.value] as [number, number]);
    }

    default:
      return points.map((p) => [p.step, p.value] as [number, number]);
  }
}

// ── Aggregation / bands ─────────────────────────────────────────────────

function std(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * 按 x（step 或 mapXAxis 后的 x）聚合多 run 序列。
 * 返回每个 x 上的统计 band。
 */
export function aggregateByX(seriesList: MetricSeries[]): AggregatedBand[] {
  const buckets = new Map<number, number[]>();
  for (const series of seriesList) {
    for (const p of series.data) {
      const arr = buckets.get(p.step) ?? [];
      arr.push(p.value);
      buckets.set(p.step, arr);
    }
  }

  const bands: AggregatedBand[] = [];
  for (const [x, values] of buckets) {
    const sorted = values.slice().sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    bands.push({
      x,
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      mean,
      std: std(values, mean),
      count: values.length,
    });
  }

  bands.sort((a, b) => a.x - b.x);
  return bands;
}

/**
 * 把聚合结果转成 1~3 条 MetricSeries，用于渲染。
 * - mean：center = mean，lower/upper = mean ± std
 * - min：lower = min，upper = max，center = mean（可隐藏）
 * - max：center = max
 */
export function buildAggregatedSeries(
  seriesList: MetricSeries[],
  method: AggregationMethod,
  options: { color?: string; lineWidth?: number; showSymbol?: boolean } = {},
): MetricSeries[] {
  if (seriesList.length === 0) return [];
  const bands = aggregateByX(seriesList);
  const baseName = seriesList[0]!.key ?? "aggregated";
  const baseColor = options.color;

  const toSeries = (
    name: string,
    getter: (b: AggregatedBand) => number,
    extra: Partial<MetricSeries> = {},
  ): MetricSeries => ({
    name,
    key: baseName,
    color: baseColor,
    data: bands.map((b) => ({ step: b.x, value: getter(b) })),
    ...extra,
  });

  if (method === "max") {
    return [toSeries(`${baseName} (max)`, (b) => b.max, { lineWidth: options.lineWidth ?? 2 })];
  }

  if (method === "min") {
    return [
      toSeries(`${baseName} (mean)`, (b) => b.mean, {
        lineWidth: options.lineWidth ?? 2,
      }),
      toSeries(`${baseName} (min)`, (b) => b.min, { lineWidth: 1 }),
      toSeries(`${baseName} (max)`, (b) => b.max, { lineWidth: 1 }),
    ];
  }

  return [
    toSeries(`${baseName} (mean)`, (b) => b.mean, {
      lineWidth: options.lineWidth ?? 2,
    }),
    toSeries(`${baseName} (+σ)`, (b) => b.mean + b.std, { lineWidth: 1 }),
    toSeries(`${baseName} (-σ)`, (b) => Math.max(0, b.mean - b.std), { lineWidth: 1 }),
  ];
}

// ── Derived metric expressions ──────────────────────────────────────────

type Token =
  | { type: "number"; value: number }
  | { type: "ident"; value: string }
  | { type: "op"; value: string }
  | { type: "eof" };

function tokenText(t: Token): string {
  if (t.type === "eof") return "EOF";
  return String(t.value);
}

class Parser {
  private tokens: Token[];
  private pos = 0;
  private context: Record<string, number>;

  constructor(expression: string, context: Record<string, number>) {
    this.tokens = tokenize(expression);
    this.context = context;
  }

  parse(): number {
    const value = this.expr();
    const t = this.peek();
    if (t.type !== "eof") {
      throw new Error(`Unexpected token "${tokenText(t)}"`);
    }
    return value;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: "eof" };
  }

  private consume(expected?: string): Token {
    const t = this.peek();
    if (expected && (t.type !== "op" || t.value !== expected)) {
      throw new Error(`Expected "${expected}" but got "${tokenText(t)}"`);
    }
    this.pos++;
    return t;
  }

  private expr(): number {
    let value = this.term();
    while (true) {
      const t = this.peek();
      if (t.type === "op" && (t.value === "+" || t.value === "-")) {
        this.consume();
        const rhs = this.term();
        value = t.value === "+" ? value + rhs : value - rhs;
      } else {
        break;
      }
    }
    return value;
  }

  private term(): number {
    let value = this.factor();
    while (true) {
      const t = this.peek();
      if (t.type === "op" && (t.value === "*" || t.value === "/" || t.value === "%")) {
        this.consume();
        const rhs = this.factor();
        if (t.value === "*") value = value * rhs;
        else if (t.value === "/") value = rhs === 0 ? NaN : value / rhs;
        else value = rhs === 0 ? NaN : value % rhs;
      } else {
        break;
      }
    }
    return value;
  }

  private factor(): number {
    const t = this.peek();
    if (t.type === "op" && (t.value === "+" || t.value === "-")) {
      this.consume();
      const value = this.factor();
      return t.value === "-" ? -value : value;
    }
    return this.power();
  }

  private power(): number {
    const base = this.primary();
    const t = this.peek();
    if (t.type === "op" && t.value === "^") {
      this.consume();
      const exp = this.factor(); // right-associative
      return Math.pow(base, exp);
    }
    return base;
  }

  private primary(): number {
    const t = this.peek();
    if (t.type === "number") {
      this.consume();
      return t.value;
    }
    if (t.type === "ident") {
      this.consume();
      const next = this.peek();
      if (next.type === "op" && next.value === "(") {
        return this.callFunction(t.value);
      }
      // 允许 metric key 里带 "/"（如 train/loss），只要整体命中 context。
      // 如果拼不出来就回退，让 "/" 作为除号处理。
      let name = t.value;
      while (true) {
        const current = this.peek();
        if (current.type !== "op" || current.value !== "/") break;
        const slashPos = this.pos;
        const identPos = slashPos + 1;
        const nextToken = this.tokens[identPos];
        if (nextToken?.type !== "ident") break;
        const candidate = `${name}/${nextToken.value}`;
        if (Object.prototype.hasOwnProperty.call(this.context, candidate)) {
          name = candidate;
          this.pos = identPos + 1;
        } else {
          break;
        }
      }
      if (Object.prototype.hasOwnProperty.call(this.context, name)) {
        return this.context[name]!;
      }
      throw new Error(`Unknown variable "${name}"`);
    }
    if (t.type === "op" && t.value === "(") {
      this.consume("(");
      const value = this.expr();
      this.consume(")");
      return value;
    }
    throw new Error(`Unexpected token "${tokenText(t)}"`);
  }

  private callFunction(name: string): number {
    this.consume("(");
    const args: number[] = [];
    const first = this.peek();
    if (first.type !== "op" || first.value !== ")") {
      args.push(this.expr());
      while (true) {
        const current = this.peek();
        if (current.type !== "op" || current.value !== ",") break;
        this.consume(",");
        args.push(this.expr());
      }
    }
    this.consume(")");

    switch (name) {
      case "abs":
        return Math.abs(args[0] ?? 0);
      case "sqrt":
        return Math.sqrt(args[0] ?? 0);
      case "log":
        return Math.log(args[0] ?? 0);
      case "pow":
        return Math.pow(args[0] ?? 0, args[1] ?? 0);
      case "min":
        return Math.min(...args);
      case "max":
        return Math.max(...args);
      case "sin":
        return Math.sin(args[0] ?? 0);
      case "cos":
        return Math.cos(args[0] ?? 0);
      default:
        throw new Error(`Unknown function "${name}"`);
    }
  }
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/\d/.test(ch) || (ch === "." && /\d/.test(expression[i + 1] ?? ""))) {
      let j = i;
      while (j < expression.length && /[\d.]/.test(expression[j]!)) j++;
      const value = parseFloat(expression.slice(i, j));
      tokens.push({ type: "number", value });
      i = j;
      continue;
    }
    if (/[+\-*/%(),^]/.test(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    // identifier / metric key / variable
    let j = i;
    while (
      j < expression.length &&
      !/\s/.test(expression[j]!) &&
      !/[+\-*/%(),^]/.test(expression[j]!)
    ) {
      j++;
    }
    tokens.push({ type: "ident", value: expression.slice(i, j) });
    i = j;
  }
  tokens.push({ type: "eof" });
  return tokens;
}

/**
 * 安全地求值一条派生指标表达式。
 * 支持 + - * / % ^、括号，以及 abs/min/max/sqrt/log/pow/sin/cos。
 * 变量从 `context` 读取。
 */
export function evaluateExpression(
  expression: string,
  context: Record<string, number>,
): number {
  return new Parser(expression, context).parse();
}

/**
 * 根据表达式和每 step 的多指标取值，生成一条新的 MetricPoint 序列。
 * 只保留所有被引用指标都存在的 step。
 */
export function deriveMetric(
  metricsByKey: Record<string, MetricPoint[]>,
  expression: string,
  options: { name?: string } = {},
): MetricSeries {
  const keys = Object.keys(metricsByKey);
  // 以第一个指标的 step 集合为基准，求交集。
  const stepSets = keys.map((k) => new Set(metricsByKey[k]!.map((p) => p.step)));
  const commonSteps = stepSets.reduce(
    (acc, set) => acc.filter((s) => set.has(s)),
    [...stepSets[0]!],
  );
  commonSteps.sort((a, b) => a - b);

  const valueByStep: Record<string, Record<number, number>> = {};
  for (const key of keys) {
    valueByStep[key] = {};
    for (const p of metricsByKey[key]!) {
      valueByStep[key]![p.step] = p.value;
    }
  }

  const data: MetricPoint[] = [];
  for (const step of commonSteps) {
    const context: Record<string, number> = {};
    for (const key of keys) {
      context[key] = valueByStep[key]![step]!;
    }
    try {
      const value = evaluateExpression(expression, context);
      if (Number.isFinite(value)) {
        data.push({ step, value });
      }
    } catch {
      // skip invalid rows
    }
  }

  return {
    name: options.name ?? expression,
    key: expression,
    data,
  };
}
