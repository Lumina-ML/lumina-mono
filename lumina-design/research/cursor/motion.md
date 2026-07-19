# Cursor：Motion

## 通用时长

- Hover 背景：80ms
- 菜单/下拉：120ms
- AI Composer 展开：200ms
- Tab 切换：150ms
- Cursor 闪烁：530ms

## 缓动

- 大部分使用 ease-out，追求编辑器般的即时响应。
- Panel 展开略带 ease-in-out。

## 反馈模式

- 按钮按下：scale(0.97)
- AI 生成时光标有脉冲动画。
- 选中状态：无阴影，仅靠边框/背景色变化。

## 可借鉴

Lumina 的交互应比 Linear 更快一档：开发者工具不容忍拖沓。Hover 80ms，常规过渡 120ms，大面板 200ms。
