import { computed, ref } from "vue";

export interface UsePaginationOptions {
  page?: number;
  pageSize?: number;
  total?: number;
  pageSizes?: number[];
}

/**
 * 分页状态 Composable。
 *
 * 管理 page / pageSize，并计算总页数、当前切片范围。
 */
export function usePagination(options: UsePaginationOptions = {}) {
  const page = ref(options.page ?? 1);
  const pageSize = ref(options.pageSize ?? 20);
  const total = ref(options.total ?? 0);
  const pageSizes = ref(options.pageSizes ?? [10, 20, 50, 100]);

  const pageCount = computed(() => Math.ceil(total.value / pageSize.value) || 1);

  const start = computed(() => (page.value - 1) * pageSize.value);
  const end = computed(() => Math.min(start.value + pageSize.value, total.value));

  function setPage(next: number) {
    page.value = Math.max(1, Math.min(next, pageCount.value));
  }

  function setPageSize(next: number) {
    pageSize.value = next;
    page.value = 1;
  }

  function setTotal(next: number) {
    total.value = next;
    if (page.value > pageCount.value) {
      page.value = Math.max(1, pageCount.value);
    }
  }

  function reset() {
    page.value = 1;
    pageSize.value = options.pageSize ?? 20;
  }

  return {
    page,
    pageSize,
    total,
    pageSizes,
    pageCount,
    start,
    end,
    setPage,
    setPageSize,
    setTotal,
    reset,
  };
}
