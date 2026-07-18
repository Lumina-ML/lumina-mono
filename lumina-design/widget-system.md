# Lumina Widget System

## 目标

Dashboard 不再写死页面，而是由可配置、可扩展的 Widget 组成。

## 架构

```
@lumina/ui/src/widgets/        # Widget 框架
  types.ts         # WidgetDefinition / LayoutItem / DashboardLayout
  registry.ts      # registerWidget / getWidget / listWidgets
  GridLayout.vue   # 响应式网格布局
  WidgetRenderer.vue  # 根据 type 渲染对应组件

apps/dashboard/src/widgets/    # 业务 Widget
  registry.ts      # 注册 dashboard 专属 Widget
  workspace-stats/
  recent-runs/
  quick-start/
  metric-chart-widget/
```

## 定义 Widget

```ts
// dashboard/src/widgets/registry.ts
registerWidgets([
  {
    type: "workspace-stats",
    name: "Workspace Stats",
    component: WorkspaceStatsWidget,
    defaultSize: { w: 12, h: 2 },
  },
]);
```

## 布局 JSON

```ts
const layout: DashboardLayout = {
  columns: 12,
  rowHeight: 80,
  gap: 16,
  widgets: [
    { id: "stats", type: "workspace-stats", x: 0, y: 0, w: 12, h: 2 },
    { id: "recent-runs", type: "recent-runs", x: 0, y: 2, w: 6, h: 4 },
    { id: "quick-start", type: "quick-start", x: 6, y: 2, w: 6, h: 4 },
  ],
};
```

## 使用

```vue
<GridLayout :layout="layout.widgets">
  <template #default="{ item }">
    <WidgetRenderer :item="item" />
  </template>
</GridLayout>
```

## 已落地页面

- `WorkspaceOverview.vue` 已改为 JSON 驱动的 Widget Dashboard

## 未来扩展

- 拖拽调整布局
- Widget 添加/删除面板
- 保存布局到后端
- Widget-level 数据刷新和实时更新
- 自定义 Widget SDK
