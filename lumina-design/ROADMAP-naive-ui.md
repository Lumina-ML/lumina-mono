# naive-ui 使用策略与替换路线图

## 策略调整

**不重新实现底层组件，而是把 naive-ui 当作 primitive 层，在其之上包一层 Lumina 组件。**

这样做的好处：
- 快速推进，不重复造轮子
- 统一 Lumina 的组件 API 和默认行为
- 未来如果要替换底层库（例如换 Radix、shadcn-vue 或完全自研），只需要改 `@lumina/ui` 内部，dashboard 代码不动

## 原则

1. **dashboard 不再直接 import `naive-ui`**，统一 import from `@lumina/ui`
2. **@lumina/ui 内部可以依赖 naive-ui**，对其做包装或扩展
3. 每个 wrapper 组件保持简单的 props，避免引入 naive-ui 复杂的类型到 SFC 中（Vue compiler 对复杂类型支持有限）
4. 复杂组件（Select、Tabs、Pagination 等）后续再逐步包装

## 组件映射表

| naive-ui 组件 | Lumina 包装组件 | 备注 |
|---|---|---|
| `NButton` | `LButton` | 已创建，支持 `size="xs/sm/md/lg"` |
| `NCard` | `LCard` | 已创建 |
| `NTag` | `LTag` | 已创建 |
| `NTag`（状态） | `LStatusBadge` | 已创建，内置 Run 状态映射 |
| `NEmpty` | `LEmpty` | 待创建 |
| `NPagination` | `LPagination` | 待创建 |
| `NSelect` | `LSelect` | 待创建 |
| `NTabs` / `NTabPane` | `LTabs` / `LTabPanel` | 待创建 |
| `NSkeleton` | `LSkeleton` | 待创建 |
| `NResult` | `LResult` | 待创建 |
| `NStatistic` | `LStatistic` | 待创建 |
| `NMenu` | `LSidebar` / `LSidebarItem` | 待创建 |
| `NBreadcrumb` / `NBreadcrumbItem` | `LBreadcrumb` | 待创建 |
| `NLayout` 系列 | 保留在 AppLayout 中或改为 Tailwind | 待定 |
| `NConfigProvider` | 移除 | 用 CSS class 切换 dark mode |
| `NSpace` | 移除 | 直接改用 Tailwind `flex gap-*` |

## 已创建的包装组件

- `packages/lumina-ui/src/primitives/LButton.vue`
- `packages/lumina-ui/src/primitives/LCard.vue`
- `packages/lumina-ui/src/primitives/LTag.vue`
- `packages/lumina-ui/src/primitives/LStatusBadge.vue`

## 试点替换计划

1. `widgets/run-status-badge/RunStatusBadge.vue` → `LStatusBadge`
2. `widgets/run-table/RunTable.vue` → `LButton`
3. 列表页中的 `NCard` → `LCard`
4. 逐步替换其他组件

## 注意事项

- naive-ui 的类型系统较复杂，wrapper 组件中**不要直接使用 `defineProps<NaiveProps>()`**，应定义简化的本地 props 接口
- 如果需要透传 naive-ui 的特殊 prop，可以走 `$attrs`
- 最终目标不是删除 naive-ui，而是让 dashboard 只依赖 `@lumina/ui`
