/**
 * Lumina Chart Language — Theme Integration
 *
 * 图表颜色/字体从 Lumina CSS tokens 读取，保证暗色模式切换时无需重建图表。
 */

import { computed, onScopeDispose, ref } from "vue";

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

function getRootElement(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

export function resolveHsl(name: string, alpha?: number): string {
  const root = getRootElement();
  if (!root) return "transparent";
  const raw = getComputedStyle(root).getPropertyValue(name).trim();
  if (!raw) return "transparent";
  return alpha === undefined ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

/**
 * 一次性读取当前 CSS tokens 生成 ECharts 可用的颜色配置。
 */
export function getChartThemeColors(): ChartThemeColors {
  return {
    backgroundColor: "transparent",
    textColor: resolveHsl("--foreground"),
    mutedTextColor: resolveHsl("--foreground-muted"),
    gridLineColor: resolveHsl("--border"),
    tooltipBackground: resolveHsl("--card"),
    tooltipBorder: resolveHsl("--border"),
    palette: [
      resolveHsl("--primary"),
      resolveHsl("--info"),
      resolveHsl("--success"),
      resolveHsl("--warning"),
      resolveHsl("--error"),
      resolveHsl("--accent"),
    ],
  };
}

/**
 * 响应式 chart 主题色。
 *
 * 监听 .dark class 与系统配色变化，返回的 colors computed 会在主题切换时失效，
 * 配合 vue-echarts 的响应式 option 自动重绘图表。
 */
export function useChartThemeColors() {
  const scheme = ref<"light" | "dark">("light");

  function sync() {
    const root = getRootElement();
    if (!root) return;
    scheme.value = root.classList.contains("dark") ? "dark" : "light";
  }

  if (typeof window !== "undefined") {
    sync();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);

    const observer = new MutationObserver(sync);
    const root = getRootElement();
    if (root) {
      observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    }

    onScopeDispose(() => {
      media.removeEventListener("change", sync);
      observer.disconnect();
    });
  }

  const colors = computed<ChartThemeColors>(() => getChartThemeColors());

  return { scheme, colors };
}
