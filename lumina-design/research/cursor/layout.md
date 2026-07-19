# Cursor：Layout

## 结构

```
Sidebar ( activity bar ) | Tab Bar | Editor / Panel
                         |         ├── Chat / Composer (AI)
                         |         └── Terminal / Logs
```

## 关键点

- 左侧是「Activity Bar」而非传统 Sidebar，图标极简，无文字标签。
- 内容区就是 Editor/Panel，没有额外 Header。
- AI Chat 以 Side Panel 或 Inline 形式出现，不破坏主工作流。
- Command Palette 是核心入口，几乎所有操作都能通过 ⌘K 触发。
- 信息密度极高，列表项高度 28~32px。

## 可借鉴

Lumina 的 Workspace 可以考虑 Activity Bar + Command Palette 的组合，减少顶部导航。Run/Trace/Registry 等模块通过 Activity Bar 切换。
