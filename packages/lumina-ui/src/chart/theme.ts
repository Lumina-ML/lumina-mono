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
    textColor: "hsl(var(--foreground))",
    mutedTextColor: "hsl(var(--foreground-muted))",
    gridLineColor: "hsl(var(--border))",
    tooltipBackground: "hsl(var(--card))",
    tooltipBorder: "hsl(var(--border))",
    palette: [
      "hsl(var(--primary))",
      "hsl(var(--info))",
      "hsl(var(--success))",
      "hsl(var(--warning))",
      "hsl(var(--error))",
      "hsl(var(--accent))",
    ],
  };
}
