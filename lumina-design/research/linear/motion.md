# Linear：Motion

## 通用时长

- Hover 背景：100ms
- 菜单展开：150ms
- 右侧 Panel 滑入：200ms
- Modal 出现：150ms scale + fade

## 缓动

- 大部分使用 ease-out，收尾利落。
- Panel 滑入有轻微弹簧感但不夸张。

## 反馈模式

- Hover：背景色淡入。
- Active：左边框 + 背景同时出现。
- 按钮按下：scale(0.98)。
- Checkbox：打勾有 120ms 路径动画。

## 可借鉴

Lumina 的所有交互统一为 120ms/180ms/240ms 三档，不要每个组件自己发挥。
