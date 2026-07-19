import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LMetricValue from "./LMetricValue.vue";

describe("LMetricValue", () => {
  it("formats number with precision", () => {
    const wrapper = mount(LMetricValue, { props: { value: 3.14159, precision: 2 } });
    expect(wrapper.text()).toBe("3.14");
  });

  it("adds thousands separator", () => {
    const wrapper = mount(LMetricValue, { props: { value: 1234567, thousands: true } });
    expect(wrapper.text()).toBe("1,234,567");
  });

  it("renders suffix", () => {
    const wrapper = mount(LMetricValue, { props: { value: 99, suffix: "%" } });
    expect(wrapper.text()).toContain("99");
    expect(wrapper.text()).toContain("%");
  });

  it("shows placeholder for null", () => {
    const wrapper = mount(LMetricValue, { props: { value: null, placeholder: "N/A" } });
    expect(wrapper.text()).toBe("N/A");
  });
});
