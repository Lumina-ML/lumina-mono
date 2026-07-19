import { describe, it, expect } from "vitest";
import { ref } from "vue";
import { useDateFormat } from "./useDateFormat";

describe("useDateFormat", () => {
  const testDate = new Date("2024-05-20T14:30:00.000Z");

  it("formats date preset", () => {
    const formatted = useDateFormat(testDate, { preset: "date", locale: "en-US" });
    expect(formatted.value).toContain("May");
    expect(formatted.value).toContain("20");
    expect(formatted.value).toContain("2024");
  });

  it("formats iso preset", () => {
    const formatted = useDateFormat(testDate, { preset: "iso" });
    expect(formatted.value).toBe(testDate.toISOString());
  });

  it("reacts to ref changes", () => {
    const value = ref<Date | undefined>(testDate);
    const formatted = useDateFormat(value, { preset: "iso" });
    expect(formatted.value).toBe(testDate.toISOString());

    const next = new Date("2025-01-01T00:00:00.000Z");
    value.value = next;
    expect(formatted.value).toBe(next.toISOString());
  });

  it("returns empty string for invalid value", () => {
    const formatted = useDateFormat("invalid");
    expect(formatted.value).toBe("");
  });
});
