/**
 * Lumina Design Language — Typography Tokens
 *
 * 以后组件不要直接使用 font-size / font-weight，而是引用这里的语义化层级。
 */

export const fontFamily = {
  sans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as const;

export const fontSize = {
  /** 页面大标题，如 Workspace 名称 */
  display: { size: '1.875rem', lineHeight: '2.25rem', fontWeight: '700' },
  /** 页面标题 */
  title: { size: '1.5rem', lineHeight: '2rem', fontWeight: '600' },
  /** 区块标题 */
  heading: { size: '1.125rem', lineHeight: '1.75rem', fontWeight: '600' },
  /** 小节标题 */
  subheading: { size: '1rem', lineHeight: '1.5rem', fontWeight: '600' },
  /** 正文 */
  body: { size: '0.875rem', lineHeight: '1.25rem', fontWeight: '400' },
  /** 小字说明 */
  caption: { size: '0.75rem', lineHeight: '1rem', fontWeight: '400' },
  /** 等宽文本，如日志、代码 */
  mono: { size: '0.8125rem', lineHeight: '1.25rem', fontWeight: '400' },
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type FontSizeToken = keyof typeof fontSize;
export type FontWeightToken = keyof typeof fontWeight;
