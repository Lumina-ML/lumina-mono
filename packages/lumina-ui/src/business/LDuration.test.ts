import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LDuration from "./LDuration.vue";

describe("LDuration", () => {
  it("formats milliseconds", () => {
    const wrapper = mount(LDuration, { props: { durationMs: 125000 } });
    expect(wrapper.text()).toBe("2m 05s");
  });

  it("formats hours", () => {
    const wrapper = mount(LDuration, { props: { durationMs: 3661000 } });
    expect(wrapper.text()).toBe("1h 01m 01s");
  });

  it("computes duration from start and end", () => {
    const startedAt = new Date("2024-01-01T10:00:00.000Z");
    const endedAt = new Date("2024-01-01T10:02:30.000Z");
    const wrapper = mount(LDuration, { props: { startedAt, endedAt } });
    expect(wrapper.text()).toBe("2m 30s");
  });

  it("shows placeholder when no data", () => {
    const wrapper = mount(LDuration, { props: { placeholder: "—" } });
    expect(wrapper.text()).toBe("—");
  });
});
