import { describe, it, expect } from "vitest";
import { usePagination } from "./usePagination";

describe("usePagination", () => {
  it("computes page count and range", () => {
    const p = usePagination({ page: 1, pageSize: 10, total: 25 });
    expect(p.pageCount.value).toBe(3);
    expect(p.start.value).toBe(0);
    expect(p.end.value).toBe(10);
  });

  it("clamps page when setting page size reduces total pages", () => {
    const p = usePagination({ page: 3, pageSize: 10, total: 25 });
    p.setPageSize(20);
    expect(p.pageSize.value).toBe(20);
    expect(p.page.value).toBe(1);
  });

  it("clamps page to valid range", () => {
    const p = usePagination({ page: 1, pageSize: 10, total: 5 });
    p.setPage(100);
    expect(p.page.value).toBe(1);
  });
});
