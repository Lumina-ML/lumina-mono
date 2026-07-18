# Lumina Chart Language (LCL)

## 目标

把图表从"拼 ECharts option"升级为声明式、可换底层渲染器、注重性能的语言。

## 架构

```
@lumina/ui/src/chart/
  types.ts          # 与库无关的 ChartConfig
  theme.ts          # LDL token 颜色注入
  adapters/
    echarts.ts      # ChartConfig → ECharts option
  ChartRenderer.vue # Vue 渲染组件
```

## ChartConfig 示例

```ts
const config: ChartConfig = {
  title: "Loss",
  xAxis: { type: "value", name: "Step", splitLine: false },
  yAxis: { type: "value", splitLine: { lineStyle: { type: "dashed" } } },
  legend: { position: "bottom", type: "scroll" },
  tooltip: { trigger: "axis", crosshair: { type: "cross" } },
  dataZoom: [
    { type: "inside", xAxisIndex: 0 },
    { type: "slider", xAxisIndex: 0 },
  ],
  series: [
    {
      type: "line",
      name: "train/loss",
      data: [[0, 0.9], [1, 0.7], [2, 0.5]],
      smooth: true,
    },
  ],
  performance: {
    samplingThreshold: 2_000,
    largeThreshold: 20_000,
  },
};
```

## 性能设计

- **自动降采样**：数据点超过 `samplingThreshold` 自动启用 `lttb`，隐藏 symbol
- **大数据模式**：超过 `largeThreshold` 启用渐进式渲染
- **合并更新**：默认 `notMerge: false`，只 diff 变化
- **懒更新**：可开启 `lazyUpdate` 减少高频数据刷新开销
- **CSS 变量主题**：颜色从 LDL tokens 读取，切换 dark mode 不重建图表

## 使用方式

```vue
<script setup>
import { ChartRenderer } from "@lumina/ui";
</script>

<template>
  <ChartRenderer :config="config" height="360px" />
</template>
```

## 已迁移组件

- `widgets/metric-chart/MetricChart.vue` 已改用 `ChartRenderer`

## 未来扩展

- 支持 `area`、`bar`、`scatter` 类型
- 未来可接入 Observable Plot / Unovis adapter
- 增加 chart-level plugin（brush、zoom sync、annotation）
