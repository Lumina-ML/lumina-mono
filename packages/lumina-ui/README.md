# @lumina/ui

Lumina 内部 UI 组件库，面向 Dashboard 与后续客户端复用。

## 设计原则

- **基于 Naive UI 封装**：MVP 阶段复用成熟组件，保持一致性与可访问性。
- **Tailwind v4 + CSS Variables**：颜色、间距、圆角等通过 token 管理，支持 light/dark 切换。
- **Control Plane 语义**：组件命名与 API 贴近 VSCode / Grafana 式的仪表盘体验。
- **Widget 优先**：提供 Widget Registry、Grid Layout、Chart Renderer 等 Dashboard 核心抽象。

## 安装

```bash
pnpm add @lumina/ui
```

## 使用

### 引入样式

在应用入口引入主题 CSS：

```ts
import "@lumina/ui/dist/style.css";
```

### 基础组件

目前已覆盖：

- **通用**：LButton, LIconButton, LCard, LTag, LAvatar, LEmpty, LSkeleton, LSpinner, LStatistic, LDivider, LResult
- **导航**：LBreadcrumb, LBreadcrumbItem, LSidebar, LSidebarItem, LMenu, LPagination, LSteps, LTimeline, LTree
- **表单**：LInput, LTextarea, LSelect, LSwitch, LCheckbox, LRadio, LRadioGroup, LSlider, LForm, LFormItem
- **反馈**：LDialog, LDrawer, LAlert, LTooltip, LPopover, LDropdown, LTable
- **图标**：LIcon（接收 lucide-vue-next 等图标组件）

```vue
<script setup lang="ts">
import { LButton, LCard, LInput, LDialog } from "@lumina/ui";
import { ref } from "vue";

const name = ref("");
const show = ref(false);
</script>

<template>
  <LCard title="Demo">
    <LInput v-model:value="name" placeholder="Enter name" />
    <LButton @click="show = true">Open</LButton>
  </LCard>

  <LDialog v-model:show="show" title="Confirm" positive-text="OK" @positive-click="show = false">
    Hello, {{ name }}
  </LDialog>
</template>
```

### 业务底座组件

面向 MLOps 场景的通用业务组件：

- **Run**：`LRunStatus`、`LRunCard`
- **Metric**：`LMetricValue`、`LMetricChart`
- **Log**：`LLogLine`
- **Artifact**：`LArtifactTree`
- **Config**：`LConfigViewer`、`LCopyable`
- **Tag**：`LTagInput`
- **Time**：`LTimestamp`、`LDuration`

```vue
<script setup lang="ts">
import { LRunCard, LMetricChart, LTagInput } from "@lumina/ui";
import { ref } from "vue";

const tags = ref(["baseline", "v1"]);
</script>

<template>
  <LRunCard
    name="exp-001"
    status="running"
    project="demo"
    :duration-ms="125000"
    :tags="tags.map(t => ({ name: t }))"
  />
  <LMetricChart
    title="loss"
    :series="[{ name: 'train', data: [[0, 0.9], [1, 0.5]] }]"
  />
  <LTagInput v-model:tags="tags" />
</template>
```

### 图表

```vue
<script setup lang="ts">
import { ChartRenderer } from "@lumina/ui";
import type { ChartConfig } from "@lumina/ui";

const config: ChartConfig = {
  xAxis: { type: "value" },
  yAxis: { type: "value" },
  series: [
    {
      type: "line",
      name: "loss",
      data: [
        [0, 0.9],
        [1, 0.5],
        [2, 0.2],
      ],
    },
  ],
};
</script>

<template>
  <ChartRenderer :config="config" height="360px" />
</template>
```

### Widget Registry

```ts
import { registerWidget } from "@lumina/ui";
import MyWidget from "./MyWidget.vue";

registerWidget({
  type: "my-widget",
  name: "My Widget",
  component: MyWidget,
  defaultSize: { w: 6, h: 4 },
});
```

### Composables

```ts
import {
  useTheme,
  usePagination,
  useWidgetData,
  useBreakpoint,
  useLocalStorage,
  useToggle,
  useClipboard,
  useCountdown,
  useDebounce,
  useDateFormat,
} from "@lumina/ui";

const { isDark, toggleDark } = useTheme();
const { page, pageSize, setPage } = usePagination({ total: 100 });
const { data, loading, refresh } = useWidgetData({ fetcher: fetchMetrics });
const { isMobile } = useBreakpoint();
const token = useLocalStorage("token", { defaultValue: "" });
const { value: open, toggle } = useToggle();
const { copy, copied } = useClipboard();
const { formatted } = useCountdown({ duration: 60, immediate: true });
const search = useDebounce(rawQuery, 300);
const createdAt = useDateFormat(run.createdAt, { preset: "datetime" });
```

## 目录结构

```
src/
├── theme/              # 设计 token 与主题变量
│   ├── tokens/         # colors, spacing, radius, shadow, motion, typography, icon, breakpoints
│   ├── provider/       # LThemeProvider
│   └── theme.css       # 全局 CSS 变量（与 Dashboard Tailwind 主题对齐）
├── primitives/         # 基础 UI 组件
├── chart/              # ChartRenderer + Lumina Chart Language
├── widgets/            # Widget Registry + Grid Layout
├── composables/        # useTheme, usePagination, useWidgetData, useBreakpoint, useDebounce,
│                       # useLocalStorage, useSessionStorage, useToggle, useClipboard,
│                       # useCountdown, useDateFormat
├── hoc/                # LAsync, LErrorBoundary, LList
└── business/           # Lumina 业务底座组件
```

## 开发

```bash
# 开发模式（监听构建）
pnpm --filter @lumina/ui dev

# 构建
pnpm --filter @lumina/ui build

# 类型检查
pnpm --filter @lumina/ui typecheck

# 测试
pnpm --filter @lumina/ui test

# 代码检查
pnpm --filter @lumina/ui lint
```
