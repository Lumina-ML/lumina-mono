/**
 * Lumina Design Language — Responsive Breakpoints
 *
 * Mobile-first：默认样式先适配移动端，再通过 min-width 向上扩展。
 * 与 Tailwind 默认断点对齐，便于组合使用。
 */

export const breakpoints = {
  /** 640px：大屏手机横屏、小平板 */
  sm: '640px',
  /** 768px：平板竖屏 */
  md: '768px',
  /** 1024px：平板横屏、小笔记本 */
  lg: '1024px',
  /** 1280px：桌面 */
  xl: '1280px',
  /** 1536px：大屏桌面 */
  '2xl': '1536px',
} as const;

export type BreakpointToken = keyof typeof breakpoints;
