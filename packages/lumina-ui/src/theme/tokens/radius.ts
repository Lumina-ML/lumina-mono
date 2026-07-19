/**
 * Lumina Design Language — Radius Tokens
 *
 * 统一圆角规范，避免 7px / 9px / 13px 这类随意值。
 */

export const radius = {
  none: '0px',
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

export type RadiusToken = keyof typeof radius;
