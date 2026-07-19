import { ref, computed, onMounted, onUnmounted } from "vue";
import { breakpoints } from "../theme/tokens/breakpoints";

const breakpointValues = {
  sm: parseInt(breakpoints.sm, 10),
  md: parseInt(breakpoints.md, 10),
  lg: parseInt(breakpoints.lg, 10),
  xl: parseInt(breakpoints.xl, 10),
  "2xl": parseInt(breakpoints["2xl"], 10),
} as const;

export type BreakpointName = keyof typeof breakpointValues;

function getCurrentBreakpoint(width: number): BreakpointName {
  if (width >= breakpointValues["2xl"]) return "2xl";
  if (width >= breakpointValues.xl) return "xl";
  if (width >= breakpointValues.lg) return "lg";
  if (width >= breakpointValues.md) return "md";
  if (width >= breakpointValues.sm) return "sm";
  return "sm";
}

/**
 * 响应式断点 Composable。
 *
 * 返回当前视口宽度、断点名，以及常用查询（isMobile、isTablet、isDesktop）。
 */
export function useBreakpoint() {
  const width = ref<number>(typeof window === "undefined" ? 0 : window.innerWidth);
  const breakpoint = computed<BreakpointName>(() => getCurrentBreakpoint(width.value));

  const isMobile = computed(() => width.value < breakpointValues.md);
  const isTablet = computed(() => width.value >= breakpointValues.md && width.value < breakpointValues.lg);
  const isDesktop = computed(() => width.value >= breakpointValues.lg);

  function update() {
    width.value = window.innerWidth;
  }

  onMounted(() => {
    window.addEventListener("resize", update);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", update);
  });

  return {
    width,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
  };
}
