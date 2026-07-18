# Lumina Mobile-First 设计原则

## 核心立场

Lumina 不是"桌面工具顺便支持手机"。

**基础组件默认就要适配移动端**，桌面端是扩展，不是默认。

## 基础规则

### 1. 触摸目标最小 44×44px

所有可交互元素在触摸设备上最小点击区域 44×44px。

```css
@media (pointer: coarse) {
  .l-button {
    min-height: 44px;
    min-width: 44px;
  }
}
```

### 2. Mobile-first 断点

```ts
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};
```

先写移动端样式，再用 `md:` / `lg:` 向上扩展。

### 3. 间距响应式

| Token | 移动端 | 桌面端 |
|---|---|---|
| Card padding | 16px | 24px |
| List item height | 48px | 40px |
| Section gap | 16px | 24px |

### 4. 组件级响应式

- **LButton**：触摸设备 44px 最小点击区；`block` 模式在移动端默认全宽
- **LCard**：移动端 padding 更紧凑
- **LSelect / LTabs**：小屏考虑改为 bottom sheet 或滚动
- **Sidebar**：移动端变为 drawer，内容区全宽
- **DataTable**：小屏横向滚动或改为 card list

### 5. 信息密度

移动端不是简单缩小字体，而是：
- 减少同时展示列数
- 隐藏次要信息到详情页
- 用 bottom sheet 代替 hover tooltip

## 禁止

- 禁止在移动端使用 hover 作为主要交互
- 禁止字体小于 14px
- 禁止两个可点击元素间距小于 8px
