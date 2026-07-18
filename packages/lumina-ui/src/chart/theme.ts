/**
 * Lumina Chart Language — Theme Integration
 *
 * 图表颜色/字体从 LDL tokens 读取，保证暗色模式切换时无需重建图表。
 */

export interface ChartThemeColors {
  backgroundColor: string;
  textColor: string;
  mutedTextColor: string;
  gridLineColor: string;
  tooltipBackground: string;
  tooltipBorder: string;
  /** 系列默认调色板 */
  palette: string[];
}

/**
 * 获取图表主题色。
 * 使用 CSS 变量，运行时自动响应 light/dark 切换。
 */
export function getChartThemeColors(): ChartThemeColors {
  return {
    backgroundColor: "transparent",
    textColor: "hsl(var(--ldl-foreground))",
    mutedTextColor: "hsl(var(--ldl-foreground-muted))",
    gridLineColor: "hsl(var(--ldl-border))",
    tooltipBackground: "hsl(var(--ldl-card))",
    tooltipBorder: "hsl(var(--ldl-border))",
    palette: [
      "hsl(var(--ldl-primary))",
      "hsl(var(--ldl-info))",
      "hsl(var(--ldl-success))",
      "hsl(var(--ldl-warning))",
      "hsl(var(--ldl-error))",
      "hsl(var(--ldl-accent))",
    ],
  };
}
