import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { useDebounce, debounce } from "./useDebounce";

describe("useDebounce", () => {
  it("delays updates", async () => {
    vi.useFakeTimers();
    const source = ref("a");
    const debounced = useDebounce(source, 200);

    source.value = "b";
    expect(debounced.value).toBe("a");

    await vi.advanceTimersByTimeAsync(200);
    expect(debounced.value).toBe("b");

    vi.useRealTimers();
  });
});

describe("debounce", () => {
  it("only invokes once within delay", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);

    d(1);
    d(2);
    d(3);
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);

    vi.useRealTimers();
  });
});
