/**
 * Lumina Design Language — Icon Tokens
 *
 * 图标尺寸规范，与文字层级对齐。
 */

export const iconSize = {
  xs: '12px',
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
  '2xl': '24px',
} as const;

export const iconStroke = {
  default: '1.5',
  bold: '2',
} as const;

export type IconSizeToken = keyof typeof iconSize;
export type IconStrokeToken = keyof typeof iconStroke;
