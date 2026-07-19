# Vercel：Layout

## 结构

```
Top Navigation (minimal) | Workspace
                         ├── Team / Project selector
                         ├── Deployments / Analytics / Logs tabs
                         └── Cards / Tables / Charts
```

## 关键点

- 顶部导航极窄，只有 Logo、项目选择器、用户头像。
- 页面内 Tab 切换代替侧边栏二级导航。
- 卡片式信息组织，间距大但信息密度不低。
- 表格行高 48px，hover 才显示操作按钮。
- 详情页常以 Modal / Drawer 形式出现，不完全跳转。

## 可借鉴

Lumina 的 Project Detail、Run Detail 可以参考 Vercel 的 Tab + Card 模式，避免传统后台的深导航树。
