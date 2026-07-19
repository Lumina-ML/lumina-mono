import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LTagInput from "./LTagInput.vue";

describe("LTagInput", () => {
  it("renders existing tags", () => {
    const wrapper = mount(LTagInput, { props: { tags: ["foo", "bar"] } });
    expect(wrapper.text()).toContain("foo");
    expect(wrapper.text()).toContain("bar");
  });

  it("emits update:tags on enter", async () => {
    const wrapper = mount(LTagInput, { props: { tags: [] } });
    const input = wrapper.find("input");
    await input.setValue("baz");
    await input.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("update:tags")?.[0]).toEqual([["baz"]]);
  });

  it("does not allow duplicates by default", async () => {
    const wrapper = mount(LTagInput, { props: { tags: ["foo"] } });
    const input = wrapper.find("input");
    await input.setValue("foo");
    await input.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("update:tags")).toBeUndefined();
  });

  it("removes tag on close click", async () => {
    const wrapper = mount(LTagInput, { props: { tags: ["foo", "bar"] } });
    const closeButtons = wrapper.findAll('[aria-label="close"]');
    await closeButtons[0]?.trigger("click");

    expect(wrapper.emitted("update:tags")?.[0]).toEqual([["bar"]]);
  });
});
