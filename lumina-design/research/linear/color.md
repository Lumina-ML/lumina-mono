# Linear：Color

## 气质

Precision（精准）。背景极干净，靠微弱灰度区分层级，从不抢内容焦点。

## 观察

- 主背景接近纯白，但不是死白，略带冷灰。
- Sidebar 与 Content 背景一致，通过 1px 右边框 `border-border` 分隔。
- Hover 状态用 `rgba(0,0,0,0.04)` 这种极淡的遮罩，不是变色。
- Active 状态用同样淡色 + 左边框高亮（1.5px accent）。
- 文字层级清晰：标题 `#000`、正文 `rgba(0,0,0,0.7)`、muted `rgba(0,0,0,0.4)`。
- 强调色低饱和，不刺眼。

## 可借鉴

Lumina 的 Run 列表、Project 列表可以参考这种"干净背景 + 微弱 Hover + 左边框 Active"的模式，避免现在 naive-ui 菜单的重阴影和强对比。
