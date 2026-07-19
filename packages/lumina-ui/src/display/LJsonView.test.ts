import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import VueJsonPretty from "vue-json-pretty";
import LJsonView from "./LJsonView.vue";

describe("LJsonView", () => {
  it("renders object data", () => {
    const wrapper = mount(LJsonView, {
      props: { data: { name: "Lumina", count: 42 } },
    });

    expect(wrapper.text()).toContain("name");
    expect(wrapper.text()).toContain("Lumina");
    expect(wrapper.text()).toContain("count");
  });

  it("parses a JSON string", () => {
    const wrapper = mount(LJsonView, {
      props: { data: '{"parsed":true}' },
    });

    expect(wrapper.text()).toContain("parsed");
  });

  it("passes virtual props to vue-json-pretty", () => {
    const wrapper = mount(LJsonView, {
      props: {
        data: { items: [1, 2, 3] },
        virtual: true,
        height: 300,
        itemHeight: 30,
      },
    });

    const pretty = wrapper.findComponent(VueJsonPretty);
    expect(pretty.exists()).toBe(true);
    expect(pretty.props("virtual")).toBe(true);
    expect(pretty.props("height")).toBe(300);
    expect(pretty.props("itemHeight")).toBe(30);
  });

  it("emits nodeClick", async () => {
    const wrapper = mount(LJsonView, {
      props: { data: { key: "value" } },
    });

    const pretty = wrapper.findComponent(VueJsonPretty);
    await pretty.vm.$emit("nodeClick", { content: "value" });

    expect(wrapper.emitted("nodeClick")?.[0]).toEqual([{ content: "value" }]);
  });
});
