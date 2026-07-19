import type { GlobalThemeOverrides } from 'naive-ui';

/**
 * naive-ui 主题覆盖。
 *
 * 将 naive-ui 的默认视觉语言替换为 Lumina Design Language。
 * 所有颜色引用全局 CSS Variables，支持 light/dark 切换。
 */

export const luminaCommonOverrides: GlobalThemeOverrides['common'] = {
  // Brand
  primaryColor: 'hsl(var(--primary))',
  primaryColorHover: 'hsl(var(--primary) / 0.9)',
  primaryColorPressed: 'hsl(var(--primary) / 0.85)',
  primaryColorSuppl: 'hsl(var(--primary))',

  infoColor: 'hsl(var(--info))',
  infoColorHover: 'hsl(var(--info) / 0.9)',
  infoColorPressed: 'hsl(var(--info) / 0.85)',
  infoColorSuppl: 'hsl(var(--info))',

  successColor: 'hsl(var(--success))',
  successColorHover: 'hsl(var(--success) / 0.9)',
  successColorPressed: 'hsl(var(--success) / 0.85)',
  successColorSuppl: 'hsl(var(--success))',

  warningColor: 'hsl(var(--warning))',
  warningColorHover: 'hsl(var(--warning) / 0.9)',
  warningColorPressed: 'hsl(var(--warning) / 0.85)',
  warningColorSuppl: 'hsl(var(--warning))',

  errorColor: 'hsl(var(--error))',
  errorColorHover: 'hsl(var(--error) / 0.9)',
  errorColorPressed: 'hsl(var(--error) / 0.85)',
  errorColorSuppl: 'hsl(var(--error))',

  // Text
  textColorBase: 'hsl(var(--foreground))',
  textColor1: 'hsl(var(--foreground))',
  textColor2: 'hsl(var(--foreground-muted))',
  textColor3: 'hsl(var(--foreground-disabled))',
  textColorDisabled: 'hsl(var(--foreground-disabled))',
  placeholderColor: 'hsl(var(--foreground-disabled))',
  placeholderColorDisabled: 'hsl(var(--foreground-disabled) / 0.6)',

  // Icon
  iconColor: 'hsl(var(--foreground-muted))',
  iconColorHover: 'hsl(var(--foreground))',
  iconColorPressed: 'hsl(var(--foreground))',
  iconColorDisabled: 'hsl(var(--foreground-disabled))',

  // Surface & Layout
  bodyColor: 'hsl(var(--background))',
  cardColor: 'hsl(var(--card))',
  modalColor: 'hsl(var(--card))',
  popoverColor: 'hsl(var(--card))',
  tableColor: 'hsl(var(--card))',
  tableHeaderColor: 'hsl(var(--muted))',
  inputColor: 'hsl(var(--card))',
  tagColor: 'hsl(var(--muted))',
  avatarColor: 'hsl(var(--muted))',
  codeColor: 'hsl(var(--muted))',
  tabColor: 'hsl(var(--muted))',
  actionColor: 'hsl(var(--muted))',
  invertedColor: 'hsl(var(--foreground))',

  // Borders & Dividers
  borderColor: 'hsl(var(--border))',
  dividerColor: 'hsl(var(--divider))',

  // Hover / Pressed
  hoverColor: 'hsl(var(--muted) / 0.6)',
  tableColorHover: 'hsl(var(--muted) / 0.4)',
  tableColorStriped: 'hsl(var(--muted) / 0.25)',
  pressedColor: 'hsl(var(--muted))',
  closeColorHover: 'hsl(var(--muted))',
  closeColorPressed: 'hsl(var(--border))',
  clearColor: 'hsl(var(--foreground-disabled))',
  clearColorHover: 'hsl(var(--foreground-muted))',
  clearColorPressed: 'hsl(var(--foreground))',

  // Opacity
  opacityDisabled: '0.5',

  // Button secondary
  buttonColor2: 'hsl(var(--secondary))',
  buttonColor2Hover: 'hsl(var(--muted))',
  buttonColor2Pressed: 'hsl(var(--border))',

  // Shadows
  boxShadow1: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
  boxShadow2: '0 4px 8px -2px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
  boxShadow3: '0 12px 24px -4px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.04)',

  // Radius
  borderRadius: '0.5rem',
  borderRadiusSmall: '0.375rem',

  // Typography
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontWeight: '400',
  fontWeightStrong: '600',

  // Motion
  cubicBezierEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  cubicBezierEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',
  cubicBezierEaseIn: 'cubic-bezier(0.4, 0, 1, 1)',
};

export const luminaComponentOverrides: GlobalThemeOverrides = {
  Button: {
    borderRadiusTiny: '0.375rem',
    borderRadiusSmall: '0.375rem',
    borderRadiusMedium: '0.5rem',
    borderRadiusLarge: '0.5rem',
    fontWeight: '500',
  },
  Card: {
    borderRadius: '0.5rem',
  },
  Tag: {
    borderRadius: '9999px',
  },
  Input: {
    border: '1px solid hsl(var(--input))',
    borderHover: '1px solid hsl(var(--foreground-disabled))',
    borderFocus: '1px solid hsl(var(--primary))',
    borderError: '1px solid hsl(var(--error))',
    boxShadowFocus: '0 0 0 2px hsl(var(--primary) / 0.2)',
    borderRadius: '0.5rem',
  },
  Select: {
    border: '1px solid hsl(var(--input))',
    borderHover: '1px solid hsl(var(--foreground-disabled))',
    borderActive: '1px solid hsl(var(--primary))',
    borderFocus: '1px solid hsl(var(--primary))',
    boxShadowActive: '0 0 0 2px hsl(var(--primary) / 0.2)',
    boxShadowFocus: '0 0 0 2px hsl(var(--primary) / 0.2)',
    borderRadius: '0.5rem',
  },
  Dialog: {
    borderRadius: '0.75rem',
    boxShadow: '0 24px 40px -8px rgb(0 0 0 / 0.12), 0 8px 16px -8px rgb(0 0 0 / 0.06)',
  },
  Drawer: {
    borderRadius: '0.75rem',
  },
  Modal: {
    borderRadius: '0.75rem',
  },
  Popover: {
    borderRadius: '0.5rem',
    boxShadow: '0 12px 24px -4px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.04)',
  },
  Dropdown: {
    borderRadius: '0.5rem',
    boxShadow: '0 12px 24px -4px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.04)',
  },
  Menu: {
    borderRadius: '0.5rem',
    itemHeight: '34px',
    itemIconColor: 'hsl(var(--foreground-muted))',
    itemTextColor: 'hsl(var(--foreground))',
    itemTextColorHover: 'hsl(var(--foreground))',
    itemColorHover: 'hsl(var(--muted) / 0.6)',
    itemColorActive: 'hsl(var(--muted))',
    itemTextColorActive: 'hsl(var(--foreground))',
    itemIconColorActive: 'hsl(var(--foreground))',
  },
  Tabs: {
    tabBorderRadius: '0.375rem',
    tabColor: 'hsl(var(--muted))',
    tabColorHover: 'hsl(var(--muted) / 0.8)',
    tabColorActive: 'hsl(var(--muted))',
  },
  Table: {
    borderRadius: '0.5rem',
    thColor: 'hsl(var(--muted))',
    tdColor: 'hsl(var(--card))',
    tdColorHover: 'hsl(var(--muted) / 0.4)',
    tdColorStriped: 'hsl(var(--muted) / 0.2)',
    borderColor: 'hsl(var(--border))',
  },
  Pagination: {
    itemBorderRadius: '0.375rem',
    itemColor: 'transparent',
    itemColorHover: 'hsl(var(--muted))',
    itemColorPressed: 'hsl(var(--border))',
    itemColorActive: 'hsl(var(--primary))',
    itemTextColorActive: 'hsl(var(--primary-foreground))',
    itemBorder: '1px solid hsl(var(--border))',
    itemBorderHover: '1px solid hsl(var(--border))',
    itemBorderActive: '1px solid hsl(var(--primary))',
  },
  Slider: {
    fillColor: 'hsl(var(--primary))',
    fillColorHover: 'hsl(var(--primary) / 0.9)',
    handleColor: 'hsl(var(--primary))',
    railColor: 'hsl(var(--border))',
    railColorHover: 'hsl(var(--foreground-disabled))',
  },
  Tree: {
    nodeBorderRadius: '0.375rem',
    nodeColorHover: 'hsl(var(--muted) / 0.6)',
    nodeColorActive: 'hsl(var(--muted))',
    nodeTextColor: 'hsl(var(--foreground))',
    nodeTextColorActive: 'hsl(var(--foreground))',
  },
  Alert: {
    borderRadius: '0.5rem',
  },
  Steps: {
    headerTextColorProcess: 'hsl(var(--foreground))',
    headerTextColorWait: 'hsl(var(--foreground-muted))',
    headerTextColorFinish: 'hsl(var(--primary))',
    stepHeaderFontWeightProcess: '600',
  },
  Timeline: {
    itemTitleTextColor: 'hsl(var(--foreground))',
    itemContentTextColor: 'hsl(var(--foreground-muted))',
    itemMetaTextColor: 'hsl(var(--foreground-disabled))',
  },
  Empty: {
    iconColor: 'hsl(var(--foreground-disabled))',
    textColor: 'hsl(var(--foreground-muted))',
  },
  Result: {
    borderRadius: '0.5rem',
  },
  Skeleton: {
    color: 'hsl(var(--muted))',
    colorEnd: 'hsl(var(--border))',
  },
  Tooltip: {
    color: 'hsl(var(--foreground))',
    textColor: 'hsl(var(--background))',
    borderRadius: '0.375rem',
    boxShadow: '0 4px 8px -2px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
  },
};

export const luminaThemeOverrides: GlobalThemeOverrides = {
  common: luminaCommonOverrides,
  ...luminaComponentOverrides,
};

/**
 * TODO: Oncall to native-ui
 * naive-ui 的 seemly 颜色引擎会在运行时用 JS 解析颜色字段(派生 hover/pressed/rgba 等),
 * 它无法解析 `hsl(var(--x))` 这种 CSS 变量引用,会抛
 * `[seemly/rgba]: Invalid color value`,导致挂载 naive 组件的整个子树崩溃。
 *
 * 因此这里把 override 里的 `hsl(var(--token))` / `hsl(var(--token) / a)` 在运行时
 * 解析为具体的 rgb()/rgba() 色值再交给 naive。CSS 变量仍是唯一真源:
 * light/dark 切换后重新调用即可拿到对应主题的解析结果。
 */
function hslTripleToRgba(raw: string, extraAlpha?: number): string {
  let alpha = extraAlpha ?? 1;
  let body = raw;
  const slash = raw.indexOf('/');
  if (slash >= 0) {
    const a = parseFloat(raw.slice(slash + 1));
    if (!Number.isNaN(a)) alpha = extraAlpha != null ? extraAlpha * a : a;
    body = raw.slice(0, slash);
  }
  const parts = body.trim().split(/\s+/);
  if (parts.length < 3) return '';
  const h = ((parseFloat(parts[0]) % 360) + 360) % 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  if (Number.isNaN(h) || Number.isNaN(s) || Number.isNaN(l)) return '';
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else[r, g, b] = [c, 0, x];
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return alpha >= 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${alpha})`;
}

const HSL_VAR_RE = /hsl\(\s*var\((--[\w-]+)\)\s*(?:\/\s*([\d.]+))?\s*\)/g;

function resolveVarsInString(value: string, styles: CSSStyleDeclaration): string {
  return value.replace(HSL_VAR_RE, (whole, token: string, alpha?: string) => {
    const raw = styles.getPropertyValue(token).trim();
    if (!raw) return whole;
    const out = hslTripleToRgba(raw, alpha != null ? parseFloat(alpha) : undefined);
    return out || whole;
  });
}

function deepResolve<T>(obj: T, styles: CSSStyleDeclaration): T {
  if (typeof obj === 'string') return resolveVarsInString(obj, styles) as unknown as T;
  if (Array.isArray(obj)) return obj.map((v) => deepResolve(v, styles)) as unknown as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const k in obj) out[k] = deepResolve((obj as Record<string, unknown>)[k], styles);
    return out as unknown as T;
  }
  return obj;
}

/**
 * 读取 `el`(默认 documentElement)上生效的 CSS 变量,把 override 中的
 * `hsl(var(--x))` 解析成具体色值。SSR 环境下返回原对象(无 window)。
 */
export function resolveThemeOverrides(
  overrides: GlobalThemeOverrides = luminaThemeOverrides,
  el?: HTMLElement | null,
): GlobalThemeOverrides {
  if (typeof window === 'undefined' || typeof document === 'undefined') return overrides;
  const target = el ?? document.documentElement;
  const styles = window.getComputedStyle(target);
  return deepResolve(overrides, styles);
}
