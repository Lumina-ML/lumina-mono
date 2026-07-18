# naive-ui 使用策略与替换路线图

## 策略

**不重新实现底层组件，把 naive-ui 当作 primitive 层，在其之上包一层 Lumina 组件。**

- dashboard 不再直接 import `naive-ui`，统一 import from `@lumina/ui`
- `@lumina/ui` 内部依赖 naive-ui，对其做包装或扩展
- 未来替换底层库时，dashboard 代码不动

## 完成状态

| naive-ui 组件 | Lumina 包装组件 | 状态 |
|---|---|---|
| `NButton` | `LButton` | ✅ |
| `NCard` | `LCard` | ✅ |
| `NTag` | `LTag` | ✅ |
| `NTag`（状态） | `LStatusBadge` | ✅ |
| `NEmpty` | `LEmpty` | ✅ |
| `NPagination` | `LPagination` | ✅ |
| `NSelect` | `LSelect` | ✅ |
| `NTabs` / `NTabPane` | `LTabs` / `LTabPane` | ✅ |
| `NSkeleton` | `LSkeleton` | ✅ |
| `NResult` | `LResult` | ✅ |
| `NStatistic` | `LStatistic` | ✅ |
| `NMenu` | `LSidebar` / `LSidebarItem` | ✅ |
| `NBreadcrumb` / `NBreadcrumbItem` | `LBreadcrumb` / `LBreadcrumbItem` | ✅ |
| `NLayout` 系列 | Tailwind + `LSidebar` | ✅ |
| `NConfigProvider` | 已移除，用 CSS `dark` class | ✅ |
| `NSpace` | Tailwind `flex gap-*` | ✅ |

## 验证

```bash
# dashboard 中已无 naive-ui 直接引用
rg "from ['\"]naive-ui['\"]" apps/dashboard/src
# 无结果
```

```bash
pnpm --filter @lumina/dashboard typecheck  # ✅
pnpm --filter @lumina/dashboard build      # ✅
```

## 已创建的包装组件

```
packages/lumina-ui/src/primitives/
  LButton.vue
  LCard.vue
  LTag.vue
  LStatusBadge.vue
  LEmpty.vue
  LPagination.vue
  LSkeleton.vue
  LResult.vue
  LSelect.vue
  LTabs.vue
  LTabPane.vue
  LIconButton.vue
  LSidebar.vue
  LSidebarItem.vue
  LBreadcrumb.vue
  LBreadcrumbItem.vue
  LStatistic.vue
```

## Mobile-First

- `LButton`：触摸设备最小 44×44 点击区
- `LCard`：移动端更紧凑 padding
- `LSidebar`：桌面端固定侧边栏，移动端抽屉
- `AppLayout`：响应式布局，小屏汉堡菜单

详见 `mobile-first.md`。

## 注意事项

- naive-ui 的类型系统复杂，wrapper 中**不要直接使用 `defineProps<NaiveProps>()`**，应定义简化的本地 props 接口
- 透传特殊 prop 可走 `$attrs`
- 最终目标不是删除 naive-ui，而是让 dashboard 只依赖 `@lumina/ui`
- 所有组件默认 mobile-first
