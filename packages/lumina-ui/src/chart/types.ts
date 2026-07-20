/**
 * Lumina Chart Language (LCL)
 *
 * 与具体图表库无关的声明式配置。底层目前使用 ECharts，
 * 但未来可以替换为 Observable Plot、D3、Unovis 等。
 */

export type ChartAxisType = "value" | "category" | "time" | "log";

export interface ChartAxis {
  type: ChartAxisType;
  name?: string;
  min?: number | "auto";
  max?: number | "auto";
  /** category 轴的类目数据 */
  data?: (string | number)[];
  /** 是否显示分隔线 */
  splitLine?: boolean | { lineStyle?: { type?: "solid" | "dashed" } };
  /** 是否显示坐标轴 */
  axisLine?: boolean;
  /** 坐标轴文字颜色由主题自动处理，除非覆盖 */
  axisLabel?: boolean | { formatter?: string | ((value: unknown) => string) };
}

export type ChartSeriesType = "line" | "bar" | "scatter" | "area" | "parallel" | "heatmap";

export interface ChartSeries {
  type: ChartSeriesType;
  name: string;
  /** 数据点数组。普通直角坐标系为 [x, y]，parallel/heatmap 按对应维度传入 */
  data: Array<(number | string | null)[]>;
  /** 覆盖默认颜色 */
  color?: string;
  /** 折线平滑 */
  smooth?: boolean;
  /** 是否显示数据点标记 */
  showSymbol?: boolean;
  /** 标记大小 */
  symbolSize?: number;
  /** 线宽 */
  lineWidth?: number;
  /** 线型 */
  lineType?: "solid" | "dashed";
  /** 面积透明度，仅 area/line 有效 */
  areaOpacity?: number;
  /**
   * 降采样算法。
   * - lttb：最大三角形三桶（Large Triangle Three Buckets），保留视觉特征
   * - average/max/min/sum：按桶聚合
   */
  sampling?: "lttb" | "average" | "max" | "min" | "sum";
  /** 大数据模式阈值 */
  largeThreshold?: number;
  /** 渐进式渲染分块大小 */
  progressive?: number;
}

export interface ChartLegend {
  show?: boolean;
  position?: "top" | "bottom" | "left" | "right";
  type?: "plain" | "scroll";
}

export interface ChartTooltip {
  trigger?: "item" | "axis" | "none";
  /** axis 触发时共享 tooltip */
  shared?: boolean;
  /** 是否显示十字准星 */
  crosshair?: boolean | { type?: "line" | "shadow" | "cross" };
  /** 自定义格式化，建议只传字符串模板或函数 */
  formatter?: string | ((params: unknown) => string);
}

export interface ChartGrid {
  left?: number | string;
  right?: number | string;
  top?: number | string;
  bottom?: number | string;
  /** 是否包含坐标轴标签 */
  containLabel?: boolean;
}

export interface ChartDataZoom {
  type: "inside" | "slider";
  xAxisIndex?: number;
  yAxisIndex?: number;
  start?: number;
  end?: number;
}

export interface ChartToolbox {
  /** 是否显示工具栏，默认 true */
  show?: boolean;
  /** 保存图片，默认 true */
  saveAsImage?: boolean;
  /** 区域缩放/缩放还原，默认 true */
  dataZoom?: boolean;
  /** 还原初始状态，默认 true */
  restore?: boolean;
}

export interface ChartBrush {
  /** 框选后回调，参数为选中的数据索引区间 */
  onBrush?: (range: { start: number; end: number }[]) => void;
  /** 限制在特定 x 轴上，默认 0 */
  xAxisIndex?: number | number[];
  /** 限制在特定 y 轴上 */
  yAxisIndex?: number | number[];
}

export interface ChartAnimation {
  enabled?: boolean;
  duration?: number;
  easing?: "linear" | "cubicOut" | "cubicInOut";
}

export interface ChartPerformance {
  /**
   * 数据点超过该阈值时自动开启降采样。
   * 默认 2000。
   */
  samplingThreshold?: number;
  /**
   * 大数据模式阈值。
   * 默认 20000。
   */
  largeThreshold?: number;
  /**
   * 是否懒更新（数据变更时不立即重绘）。
   * 默认 false。
   */
  lazyUpdate?: boolean;
  /**
   * setOption 时是否全量替换。
   * 默认 false（合并更新，性能更好）。
   */
  notMerge?: boolean;
}

export interface ChartParallelAxis {
  dim: number;
  name: string;
  type: "value" | "category";
  /** category 轴需要传入完整类目 */
  data?: (string | number)[];
}

export interface ChartVisualMap {
  min?: number;
  max?: number;
  inRange?: { color?: string[] };
}

export interface ChartConfig {
  title?: string;
  /** 普通直角坐标轴；parallel/heatmap 按需传入 */
  xAxis?: ChartAxis;
  yAxis?: ChartAxis;
  series: ChartSeries[];
  legend?: ChartLegend;
  tooltip?: ChartTooltip;
  grid?: ChartGrid;
  dataZoom?: ChartDataZoom[];
  toolbox?: ChartToolbox;
  brush?: ChartBrush;
  animation?: ChartAnimation;
  /** parallel 坐标系维度定义 */
  parallelAxes?: ChartParallelAxis[];
  /** heatmap 数值映射 */
  visualMap?: ChartVisualMap;
  /** 覆盖默认背景色 */
  backgroundColor?: string;
  /** 性能调优 */
  performance?: ChartPerformance;
}
