# Lumina Design System

这不是一套"UI 组件库"，而是 **Lumina Design Language（LDL）** 的沉淀仓库。

参考 `docs/How-To-Design.md` 的十个阶段，按以下节奏推进：

```text
Phase 1（Foundation）
──────────────────────────────
Design Tokens
Color / Typography / Spacing / Radius / Motion / Icons

↓

Phase 2（Primitives）
──────────────────────────────
Button / Input / Card / Dialog / Popover / Tooltip / Dropdown / Tabs / Sidebar

↓

Phase 3（Data Components）
──────────────────────────────
VirtualTable / ArtifactTree / MetricCard / LogViewer / CodeViewer / ChartRenderer / Timeline

↓

Phase 4（Dashboard）
──────────────────────────────
Grid Engine / Widget Registry / Layout JSON / Drag & Drop / Responsive Layout

↓

Phase 5（Workspace）
──────────────────────────────
Command Palette / Dock Panel / Split View / Multi Tabs / Inspector / Quick Actions

↓

Phase 6（Platform）
──────────────────────────────
Plugin System / Custom Widget SDK / Theme SDK / Marketplace
```

## 研究目录

`research/` 下按产品拆分，每个产品里按维度写分析：

- `color.md`：配色、层级、强调色、状态色
- `motion.md`：动画时长、缓动、反馈
- `layout.md`：布局结构、导航、面板
- `spacing.md`：间距系统、信息密度
- `typography.md`：字体层级、字重、行高
- `navigation.md`：导航模式、面包屑、Command
- `command.md`：快捷键、Command Palette、Quick Action

## 研究原则

不要写"好看"。要写：

```text
Sidebar:
- Hover: background transparent → rgba(0,0,0,0.04)
- Padding: 8px 12px
- Active: background rgba(0,0,0,0.08), border-radius 6px
- Radius: 6px
- Icon: 16px, color muted
- Transition: 120ms ease
- Opacity: 0.6 → 1 on hover
```

## 当前阶段

Phase 1：Foundation
