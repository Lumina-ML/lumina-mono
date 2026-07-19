import { ref, watch, type Ref } from "vue";

/**
 * 防抖 Composable。
 *
 * @param source 源响应式值
 * @param delay 延迟毫秒数，默认 300
 * @returns 防抖后的响应式值
 */
export function useDebounce<T>(source: Ref<T>, delay = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>;
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(
    source,
    (value) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        debounced.value = value;
      }, delay);
    },
    { immediate: true },
  );

  return debounced;
}

/**
 * 创建防抖函数。
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay = 300,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
