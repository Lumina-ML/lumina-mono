import type { EChartsOption, SeriesOption, DataZoomComponentOption } from "echarts";
import type {
  ChartAxis,
  ChartBrush,
  ChartConfig,
  ChartDataZoom,
  ChartLegend,
  ChartParallelAxis,
  ChartPerformance,
  ChartSeries,
  ChartToolbox,
  ChartTooltip,
  ChartVisualMap,
} from "../types";
import type { ChartThemeColors } from "../theme";
import { getChartThemeColors, resolveHsl } from "../theme";

const DEFAULT_SAMPLING_THRESHOLD = 2_000;
const DEFAULT_LARGE_THRESHOLD = 20_000;

function buildAxisBase(axis: ChartAxis, theme: ChartThemeColors) {
  return {
    type: axis.type as any,
    name: axis.name,
    min: axis.min,
    max: axis.max,
    data: axis.data,
    axisLine: axis.axisLine === false ? { show: false } : { lineStyle: { color: theme.mutedTextColor } },
    axisLabel:
      axis.axisLabel === false
        ? { show: false }
        : {
            color: theme.mutedTextColor,
            formatter:
              typeof axis.axisLabel === "object" ? axis.axisLabel.formatter : undefined,
          },
    axisTick: { show: false },
    splitLine:
      axis.splitLine === false
        ? { show: false }
        : {
            show: true,
            lineStyle: {
              type:
                typeof axis.splitLine === "object"
                  ? (axis.splitLine.lineStyle?.type ?? "dashed")
                  : "dashed",
              color: theme.gridLineColor,
            },
          },
    nameTextStyle: { color: theme.mutedTextColor },
  };
}

function buildXAxis(axis: ChartAxis, theme: ChartThemeColors): EChartsOption["xAxis"] {
  return buildAxisBase(axis, theme) as EChartsOption["xAxis"];
}

function buildYAxis(axis: ChartAxis, theme: ChartThemeColors): EChartsOption["yAxis"] {
  return buildAxisBase(axis, theme) as EChartsOption["yAxis"];
}

function applyPerformance(
  series: ChartSeries,
  performance: ChartPerformance | undefined,
): Partial<ChartSeries> {
  const samplingThreshold = performance?.samplingThreshold ?? DEFAULT_SAMPLING_THRESHOLD;
  const largeThreshold = performance?.largeThreshold ?? DEFAULT_LARGE_THRESHOLD;
  const dataLength = series.data.length;

  const result: Partial<ChartSeries> = {};

  if (dataLength > samplingThreshold) {
    result.sampling = series.sampling ?? "lttb";
    result.showSymbol = series.showSymbol ?? false;
  }

  if (dataLength > largeThreshold) {
    result.progressive = series.progressive ?? 5_000;
  }

  return result;
}

function buildSeries(
  series: ChartSeries,
  performance: ChartPerformance | undefined,
  theme: ChartThemeColors,
): SeriesOption {
  const perf = applyPerformance(series, performance);

  const base = {
    name: series.name,
    data: series.data,
    itemStyle: series.color ? { color: series.color } : undefined,
    smooth: series.smooth ?? false,
    showSymbol: perf.showSymbol ?? series.showSymbol ?? false,
    symbolSize: series.symbolSize,
    sampling: perf.sampling ?? series.sampling,
    progressive: perf.progressive ?? series.progressive,
    large: series.largeThreshold ? series.data.length > series.largeThreshold : undefined,
    largeThreshold: series.largeThreshold,
    animationDuration: 300,
  };

  switch (series.type) {
    case "line":
    case "area":
      return {
        ...base,
        type: "line",
        lineStyle: {
          width: series.lineWidth ?? 2,
          type: series.lineType ?? "solid",
        },
        areaStyle:
          series.type === "area"
            ? { opacity: series.areaOpacity ?? 0.1 }
            : undefined,
      } as SeriesOption;
    case "bar":
      return {
        ...base,
        type: "bar",
      } as SeriesOption;
    case "scatter":
      return {
        ...base,
        type: "scatter",
      } as SeriesOption;
    case "parallel":
      return {
        name: series.name,
        type: "parallel",
        data: series.data,
        lineStyle: {
          width: series.lineWidth ?? 2,
          color: series.color,
        },
        smooth: series.smooth ?? false,
      } as SeriesOption;
    case "heatmap":
      return {
        name: series.name,
        type: "heatmap",
        data: series.data,
        label: { show: false },
        emphasis: {
          itemStyle: {
            borderColor: theme.mutedTextColor,
            borderWidth: 1,
          },
        },
      } as SeriesOption;
    default:
      return { ...base, type: "line" } as SeriesOption;
  }
}

function buildLegend(legend: ChartLegend | undefined, theme: ChartThemeColors): EChartsOption["legend"] {
  if (legend?.show === false) return { show: false };

  const positionMap: Record<string, string> = {
    top: "top",
    bottom: "bottom",
    left: "left",
    right: "right",
  };

  return {
    show: legend?.show ?? true,
    [positionMap[legend?.position ?? "bottom"]]: 0,
    type: legend?.type ?? "scroll",
    textStyle: { color: theme.mutedTextColor },
  };
}

function buildTooltip(tooltip: ChartTooltip | undefined, theme: ChartThemeColors): EChartsOption["tooltip"] {
  return {
    trigger: tooltip?.trigger ?? "axis",
    axisPointer:
      tooltip?.crosshair === false
        ? { type: "none" }
        : {
            type:
              typeof tooltip?.crosshair === "object"
                ? (tooltip.crosshair.type ?? "cross")
                : "cross",
            label: { backgroundColor: theme.tooltipBackground },
          },
    backgroundColor: theme.tooltipBackground,
    borderColor: theme.tooltipBorder,
    textStyle: { color: theme.textColor },
    formatter: tooltip?.formatter,
  };
}

function buildDataZoom(dz: ChartDataZoom, theme: ChartThemeColors): DataZoomComponentOption {
  const base = {
    type: dz.type,
    xAxisIndex: dz.xAxisIndex,
    yAxisIndex: dz.yAxisIndex,
  };

  if (dz.type === "slider") {
    return {
      ...base,
      start: dz.start ?? 0,
      end: dz.end ?? 100,
      bottom: 0,
      height: 20,
      borderColor: "transparent",
      fillerColor: resolveHsl("--primary", 0.2),
      handleStyle: { color: resolveHsl("--primary") },
      textStyle: { color: theme.mutedTextColor },
    } as DataZoomComponentOption;
  }

  return base as DataZoomComponentOption;
}

function buildToolbox(
  toolbox: ChartToolbox | undefined,
  theme: ChartThemeColors,
): EChartsOption["toolbox"] {
  const show = toolbox?.show ?? true;
  if (!show) return { show: false };

  return {
    show: true,
    right: 12,
    top: 0,
    itemSize: 14,
    itemGap: 12,
    iconStyle: {
      borderColor: theme.mutedTextColor,
    },
    emphasis: {
      iconStyle: {
        borderColor: theme.textColor,
      },
    },
    feature: {
      saveAsImage:
        toolbox?.saveAsImage === false
          ? undefined
          : {
              show: true,
              title: "Save",
              pixelRatio: 2,
            },
      dataZoom:
        toolbox?.dataZoom === false
          ? undefined
          : {
              show: true,
              title: { zoom: "Zoom", back: "Reset" },
            },
      restore:
        toolbox?.restore === false
          ? undefined
          : {
              show: true,
              title: "Reset",
            },
    },
  };
}

function buildBrush(brush: ChartBrush | undefined): EChartsOption["brush"] {
  if (!brush) return undefined;

  return {
    toolbox: ["rect", "polygon", "lineX", "lineY", "keep", "clear"],
    xAxisIndex: brush.xAxisIndex ?? 0,
    yAxisIndex: brush.yAxisIndex,
    throttleType: "debounce",
    throttleDelay: 300,
  };
}

function buildParallelAxis(
  axes: ChartParallelAxis[] | undefined,
  theme: ChartThemeColors,
): EChartsOption["parallelAxis"] {
  if (!axes) return undefined;
  return axes.map((axis) => ({
    dim: axis.dim,
    name: axis.name,
    type: axis.type,
    data: axis.data,
    nameTextStyle: { color: theme.textColor },
    axisLine: { lineStyle: { color: theme.mutedTextColor } },
    axisLabel: { color: theme.mutedTextColor },
  })) as EChartsOption["parallelAxis"];
}

function buildParallel(): EChartsOption["parallel"] {
  return {
    left: "5%",
    right: "13%",
    bottom: "10%",
    top: "20%",
  };
}

function buildVisualMap(
  vm: ChartVisualMap | undefined,
  theme: ChartThemeColors,
): EChartsOption["visualMap"] {
  if (!vm) return undefined;
  return {
    min: vm.min,
    max: vm.max,
    calculable: true,
    orient: "horizontal",
    left: "center",
    bottom: 0,
    inRange: {
      color: vm.inRange?.color ?? [
        theme.backgroundColor,
        resolveHsl("--primary", 0.6),
        resolveHsl("--primary"),
      ],
    },
    textStyle: { color: theme.textColor },
  } as EChartsOption["visualMap"];
}

/**
 * 把 Lumina ChartConfig 转成 ECharts option。
 */
export function toEChartsOption(
  config: ChartConfig,
  themeColors?: ChartThemeColors,
): EChartsOption {
  const theme = themeColors ?? getChartThemeColors();
  const hasParallel = config.series.some((s) => s.type === "parallel");
  const hasHeatmap = config.series.some((s) => s.type === "heatmap");

  const base: EChartsOption = {
    backgroundColor: config.backgroundColor ?? theme.backgroundColor,
    color: theme.palette,
    title: config.title
      ? {
          text: config.title,
          left: "center",
          textStyle: { fontSize: 14, fontWeight: "normal", color: theme.textColor },
        }
      : undefined,
    tooltip: buildTooltip(config.tooltip, theme),
    legend: buildLegend(config.legend, theme),
    toolbox: buildToolbox(config.toolbox, theme),
    brush: buildBrush(config.brush),
    grid: {
      left: config.grid?.left ?? "3%",
      right: config.grid?.right ?? "4%",
      top: config.grid?.top ?? "15%",
      bottom: config.grid?.bottom ?? "15%",
      containLabel: config.grid?.containLabel ?? true,
    },
    dataZoom: config.dataZoom?.map((dz) => buildDataZoom(dz, theme)) as
      | DataZoomComponentOption[]
      | undefined,
    series: config.series.map((s) => buildSeries(s, config.performance, theme)) as SeriesOption[],
    animation: config.animation?.enabled ?? true,
    animationDuration: config.animation?.duration ?? 300,
    animationEasing: config.animation?.easing ?? "cubicOut",
  };

  if (hasParallel) {
    base.parallelAxis = buildParallelAxis(config.parallelAxes, theme);
    base.parallel = buildParallel();
  } else {
    if (config.xAxis) base.xAxis = buildXAxis(config.xAxis, theme);
    if (config.yAxis) base.yAxis = buildYAxis(config.yAxis, theme);
  }

  if (hasHeatmap) {
    base.visualMap = buildVisualMap(config.visualMap, theme);
  }

  return base;
}
