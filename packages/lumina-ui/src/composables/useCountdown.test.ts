import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCountdown } from "./useCountdown";

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats remaining time", () => {
    const c = useCountdown({ duration: 65 });
    expect(c.formatted.value).toBe("01:05");
  });

  it("counts down when started", async () => {
    const c = useCountdown({ duration: 5 });
    c.start();
    expect(c.isRunning.value).toBe(true);

    await vi.advanceTimersByTimeAsync(3000);
    expect(c.remaining.value).toBe(2);
    expect(c.formatted.value).toBe("00:02");
  });

  it("pauses and resumes", async () => {
    const c = useCountdown({ duration: 5 });
    c.start();
    await vi.advanceTimersByTimeAsync(2000);
    c.pause();
    expect(c.isRunning.value).toBe(false);
    expect(c.remaining.value).toBe(3);

    c.resume();
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.remaining.value).toBe(2);
  });

  it("stops at zero", async () => {
    const c = useCountdown({ duration: 2 });
    c.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(c.remaining.value).toBe(0);
    expect(c.isRunning.value).toBe(false);
  });
});
