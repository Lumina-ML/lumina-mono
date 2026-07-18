# Linear：Layout

## 结构

```
Sidebar (200px) | Header (44px) | Workspace
                |               ├── List / Board / Timeline
                |               └── Detail Panel (右侧滑出)
```

## 关键点

- Sidebar 与 Header 高度集成，Logo 区域也是 44px。
- 内容区没有多余内边距，列表直接顶到边缘。
- 详情页不是新页面，而是右侧 Drawer / Panel 滑出。
- 空状态极简，一个图标 + 一句文案 + 一个主按钮。

## 可借鉴

Lumina 的 Run Detail、Trace Detail 不要做成整页跳转，考虑右侧 Inspector Panel。Workspace 内的 Project/Run/Trace 应该保持在同一空间层级。
