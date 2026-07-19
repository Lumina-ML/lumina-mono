import { ref, computed } from "vue";

export interface UseWidgetDataOptions<T> {
  /** 初始数据 */
  initialData?: T;
  /** 异步获取数据的方法 */
  fetcher?: () => Promise<T>;
  /** 是否立即执行 */
  immediate?: boolean;
}

/**
 * Widget 数据获取 Composable。
 *
 * 封装 loading / error / data 状态，适合在 Widget 内部统一使用。
 */
export function useWidgetData<T>(options: UseWidgetDataOptions<T> = {}) {
  const data = ref<T | undefined>(options.initialData);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const hasData = computed(() => data.value !== undefined && data.value !== null);

  async function refresh() {
    if (!options.fetcher) return;
    loading.value = true;
    error.value = null;
    try {
      data.value = await options.fetcher();
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      loading.value = false;
    }
  }

  if (options.immediate && options.fetcher) {
    refresh();
  }

  return {
    data,
    loading,
    error,
    hasData,
    refresh,
  };
}
