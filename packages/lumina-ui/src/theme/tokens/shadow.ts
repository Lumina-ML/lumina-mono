/**
 * Lumina Design Language — Shadow Tokens
 *
 */

export const shadow = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.06), 0 1px 1px -1px rgb(0 0 0 / 0.04)',
  md: '0 4px 8px -2px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
  lg: '0 12px 24px -4px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.04)',
  xl: '0 24px 40px -8px rgb(0 0 0 / 0.12), 0 8px 16px -8px rgb(0 0 0 / 0.06)',
  '2xl': '0 32px 64px -16px rgb(0 0 0 / 0.16)',
  inner: 'inset 0 1px 2px 0 rgb(0 0 0 / 0.04)',
} as const;

export type ShadowToken = keyof typeof shadow;
