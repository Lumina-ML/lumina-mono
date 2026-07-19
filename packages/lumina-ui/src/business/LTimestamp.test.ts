import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LTimestamp from "./LTimestamp.vue";

describe("LTimestamp", () => {
  it("formats date with datetime preset", () => {
    const wrapper = mount(LTimestamp, {
      props: { value: new Date("2024-05-20T14:30:00.000Z"), preset: "iso" },
    });
    expect(wrapper.text()).toContain("2024-05-20T14:30:00.000Z");
  });

  it("formats string date", () => {
    const wrapper = mount(LTimestamp, {
      props: { value: "2024-05-20T14:30:00.000Z", preset: "date" },
    });
    expect(wrapper.text()).toContain("2024");
  });

  it("renders empty for invalid value", () => {
    const wrapper = mount(LTimestamp, { props: { value: "invalid" } });
    expect(wrapper.text()).toBe("");
  });
});
