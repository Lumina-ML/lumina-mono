# @lumina/ui

Lumina 内部 UI 组件库，面向 Dashboard 与后续客户端复用。

## 设计原则

- **设计语言**：参考 Linear（Precision）+ Cursor（Developer Dark）+ Vercel（Minimal），沉淀 Lumina 自己的气质。
- **Design Tokens**：颜色、间距、圆角、动效全部 token 化，运行时切换 light/dark 只需切换 class。
- **Layer System**：Canvas → Surface → Panel → Overlay → Floating，统一层级语义。
- **Control Plane 语义**：组件命名与 API 贴近 VSCode / Grafana 式的仪表盘体验。
- **Widget 优先**：提供 Widget Registry、Grid Layout、Chart Renderer 等 Dashboard 核心抽象。

## Design Tokens

所有视觉值收敛到 `src/theme/tokens/`，并在 `theme.css` 中以 CSS Variables 暴露：

```
tokens/
├── colors.ts      # 颜色 token（引用 CSS 变量）
├── spacing.ts     # 4px 栅格间距
├── radius.ts      # xs / sm / md / lg / xl
├── shadow.ts      # 极淡阴影，层级靠边框和背景差
├── motion.ts      # fast 80ms / normal 150ms / slow 220ms
├── typography.ts  # Display / Title / Heading / Body / Caption / Mono
├── icon.ts        # 图标尺寸与线宽
└── breakpoints.ts # 响应式断点
```

### 颜色层级（Layer System）

参考 Linear：背景极干净，层级靠微弱灰度和 1px 边框区分。

```css
--background    /* 页面背景，接近纯白或极深黑 */
--canvas        /* 与 background 一致 */
--surface       /* 卡片/浮层面板 */
--panel         /* Sidebar / Inspector 面板 */
--panel-hover   /* 极淡 hover 遮罩 */
--card          /* 卡片背景 */
--border        /* 极淡边框 */
--foreground    /* 主文字 */
--foreground-muted /* 次要文字 */
--primary       /* 低饱和 Indigo */
```

### 动效

```css
--duration-fast: 80ms;    /* Hover / Scale */
--duration-normal: 150ms; /* Menu / Dropdown / Tooltip */
--duration-slow: 220ms;   /* Dialog / Panel */
```

## 安装

```bash
pnpm add @lumina/ui
```

## 使用

### 引入样式

在应用入口引入主题 CSS，并用 `LThemeProvider` 包裹应用：

```ts
import "@lumina/ui/dist/style.css";
```

```vue
<script setup lang="ts">
import { LThemeProvider } from "@lumina/ui";
</script>

<template>
  <LThemeProvider>
    <RouterView />
  </LThemeProvider>
</template>
```

`LThemeProvider` 内部使用 naive-ui 的 `NConfigProvider` 注入 `luminaThemeOverrides`，让所有 naive-ui 组件吃上 Lumina 的 Design Token。应用层只需引入一次，无需再自己配置 naive-ui 主题。

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
