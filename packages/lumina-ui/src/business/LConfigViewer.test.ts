import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LConfigViewer from "./LConfigViewer.vue";

describe("LConfigViewer", () => {
  it("renders pretty JSON", () => {
    const wrapper = mount(LConfigViewer, {
      props: { value: { lr: 0.01, epochs: 10 } },
    });
    expect(wrapper.text()).toContain('"lr"');
    expect(wrapper.text()).toContain("0.01");
    expect(wrapper.text()).toContain("10");
  });

  it("shows more indicator when lines exceed max", () => {
    const wrapper = mount(LConfigViewer, {
      props: { value: { a: 1, b: 2, c: 3, d: 4 }, maxLines: 2 },
    });
    expect(wrapper.text()).toContain("more lines");
  });

  it("renders placeholder for undefined", () => {
    const wrapper = mount(LConfigViewer, { props: {} });
    expect(wrapper.text()).toBe("");
  });
});
