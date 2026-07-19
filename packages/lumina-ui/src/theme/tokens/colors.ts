/**
 * Lumina Design Language — Color Tokens
 *
 * 使用 CSS 变量实现运行时主题切换，TypeScript 常量保证组件引用一致性。
 * 所有颜色值均为 HSL 格式，与 Tailwind 4 的 @theme 机制兼容。
 */

export const colors = {
  /* Layer System */
  canvas: 'hsl(var(--ldl-canvas))',
  surface: 'hsl(var(--ldl-surface))',
  panel: 'hsl(var(--ldl-panel))',
  'panel-hover': 'hsl(var(--ldl-panel-hover))',
  card: 'hsl(var(--ldl-card))',
  'card-hover': 'hsl(var(--ldl-card-hover))',
  overlay: 'hsl(var(--ldl-overlay))',
  floating: 'hsl(var(--ldl-floating))',

  /* Borders & Dividers */
  border: 'hsl(var(--ldl-border))',
  divider: 'hsl(var(--ldl-divider))',
  selection: 'hsl(var(--ldl-selection))',

  /* Foreground / Text */
  foreground: 'hsl(var(--ldl-foreground))',
  'foreground-muted': 'hsl(var(--ldl-foreground-muted))',
  'foreground-disabled': 'hsl(var(--ldl-foreground-disabled))',

  /* Brand / Accent */
  primary: 'hsl(var(--ldl-primary))',
  'primary-foreground': 'hsl(var(--ldl-primary-foreground))',
  secondary: 'hsl(var(--ldl-secondary))',
  'secondary-foreground': 'hsl(var(--ldl-secondary-foreground))',
  accent: 'hsl(var(--ldl-accent))',
  'accent-foreground': 'hsl(var(--ldl-accent-foreground))',

  /* States */
  muted: 'hsl(var(--ldl-muted))',
  'muted-foreground': 'hsl(var(--ldl-muted-foreground))',
  destructive: 'hsl(var(--ldl-destructive))',
  'destructive-foreground': 'hsl(var(--ldl-destructive-foreground))',
  info: 'hsl(var(--ldl-info))',
  success: 'hsl(var(--ldl-success))',
  warning: 'hsl(var(--ldl-warning))',
  error: 'hsl(var(--ldl-error))',

  /* Focus / Ring */
  ring: 'hsl(var(--ldl-ring))',
} as const;

export type ColorToken = keyof typeof colors;
