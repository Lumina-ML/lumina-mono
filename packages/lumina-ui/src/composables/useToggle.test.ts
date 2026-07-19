import { describe, it, expect } from "vitest";
import { useToggle } from "./useToggle";

describe("useToggle", () => {
  it("defaults to false", () => {
    const t = useToggle();
    expect(t.value.value).toBe(false);
  });

  it("respects default value", () => {
    const t = useToggle({ defaultValue: true });
    expect(t.value.value).toBe(true);
  });

  it("toggles", () => {
    const t = useToggle();
    t.toggle();
    expect(t.value.value).toBe(true);
    t.toggle();
    expect(t.value.value).toBe(false);
  });

  it("sets explicitly", () => {
    const t = useToggle();
    t.setTrue();
    expect(t.value.value).toBe(true);
    t.setFalse();
    expect(t.value.value).toBe(false);
    t.set(true);
    expect(t.value.value).toBe(true);
  });
});
