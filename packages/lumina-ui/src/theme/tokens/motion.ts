/**
 * Lumina Design Language — Motion Tokens
 * 所有动画统一使用三档时长 + 标准缓动，避免每个组件自行发挥。
 */

export const duration = {
  /** 80ms：Hover、Opacity、Scale 等即时反馈 */
  fast: '80ms',
  /** 150ms：菜单、Dropdown、Tooltip、Sidebar 展开 */
  normal: '150ms',
  /** 220ms：Dialog、Panel、Modal 进入退出 */
  slow: '220ms',
} as const;

export const easing = {
  /** 默认 ease-out，收尾利落 */
  default: 'cubic-bezier(0, 0, 0.2, 1)',
  /** 进入 */
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  /** 退出 */
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  /** 轻微弹性，用于 Panel 滑入 */
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const transition = {
  fast: `${duration.fast} ${easing.default}`,
  normal: `${duration.normal} ${easing.default}`,
  slow: `${duration.slow} ${easing.default}`,
  'slow-spring': `${duration.slow} ${easing.spring}`,
} as const;

export type DurationToken = keyof typeof duration;
export type EasingToken = keyof typeof easing;
export type TransitionToken = keyof typeof transition;
