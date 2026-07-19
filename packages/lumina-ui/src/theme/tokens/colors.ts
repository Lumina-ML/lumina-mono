/**
 * Lumina Design Language — Color Tokens
 *
 * 使用 CSS 变量实现运行时主题切换，TypeScript 常量保证组件引用一致性。
 * 所有颜色值均为 HSL 格式，与 Tailwind 4 的 @theme 机制兼容。
 */

export const colors = {
  /* Layer System */
  background: 'hsl(var(--background))',
  canvas: 'hsl(var(--canvas))',
  surface: 'hsl(var(--surface))',
  panel: 'hsl(var(--panel))',
  'panel-hover': 'hsl(var(--panel-hover))',
  card: 'hsl(var(--card))',
  'card-hover': 'hsl(var(--card-hover))',
  'card-foreground': 'hsl(var(--card-foreground))',
  overlay: 'hsl(var(--overlay))',
  floating: 'hsl(var(--floating))',

  /* Borders & Dividers */
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  divider: 'hsl(var(--divider))',
  selection: 'hsl(var(--selection))',

  /* Foreground / Text */
  foreground: 'hsl(var(--foreground))',
  'foreground-muted': 'hsl(var(--foreground-muted))',
  'foreground-disabled': 'hsl(var(--foreground-disabled))',

  /* Brand / Accent */
  primary: 'hsl(var(--primary))',
  'primary-foreground': 'hsl(var(--primary-foreground))',
  secondary: 'hsl(var(--secondary))',
  'secondary-foreground': 'hsl(var(--secondary-foreground))',
  accent: 'hsl(var(--accent))',
  'accent-foreground': 'hsl(var(--accent-foreground))',

  /* States */
  muted: 'hsl(var(--muted))',
  'muted-foreground': 'hsl(var(--muted-foreground))',
  destructive: 'hsl(var(--destructive))',
  'destructive-foreground': 'hsl(var(--destructive-foreground))',
  info: 'hsl(var(--info))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  error: 'hsl(var(--error))',

  /* Focus / Ring */
  ring: 'hsl(var(--ring))',

  /* Legacy LDL aliases */
  'ldl-foreground': 'hsl(var(--ldl-foreground))',
  'ldl-foreground-muted': 'hsl(var(--ldl-foreground-muted))',
  'ldl-foreground-disabled': 'hsl(var(--ldl-foreground-disabled))',
  'ldl-canvas': 'hsl(var(--ldl-canvas))',
  'ldl-surface': 'hsl(var(--ldl-surface))',
  'ldl-panel': 'hsl(var(--ldl-panel))',
  'ldl-panel-hover': 'hsl(var(--ldl-panel-hover))',
  'ldl-card': 'hsl(var(--ldl-card))',
  'ldl-card-hover': 'hsl(var(--ldl-card-hover))',
  'ldl-overlay': 'hsl(var(--ldl-overlay))',
  'ldl-floating': 'hsl(var(--ldl-floating))',
  'ldl-border': 'hsl(var(--ldl-border))',
  'ldl-divider': 'hsl(var(--ldl-divider))',
  'ldl-selection': 'hsl(var(--ldl-selection))',
  'ldl-primary': 'hsl(var(--ldl-primary))',
  'ldl-primary-foreground': 'hsl(var(--ldl-primary-foreground))',
  'ldl-secondary': 'hsl(var(--ldl-secondary))',
  'ldl-secondary-foreground': 'hsl(var(--ldl-secondary-foreground))',
  'ldl-accent': 'hsl(var(--ldl-accent))',
  'ldl-accent-foreground': 'hsl(var(--ldl-accent-foreground))',
  'ldl-muted': 'hsl(var(--ldl-muted))',
  'ldl-muted-foreground': 'hsl(var(--ldl-muted-foreground))',
  'ldl-destructive': 'hsl(var(--ldl-destructive))',
  'ldl-destructive-foreground': 'hsl(var(--ldl-destructive-foreground))',
  'ldl-info': 'hsl(var(--ldl-info))',
  'ldl-success': 'hsl(var(--ldl-success))',
  'ldl-warning': 'hsl(var(--ldl-warning))',
  'ldl-error': 'hsl(var(--ldl-error))',
  'ldl-ring': 'hsl(var(--ldl-ring))',
} as const;

export type ColorToken = keyof typeof colors;
