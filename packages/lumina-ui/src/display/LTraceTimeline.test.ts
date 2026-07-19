import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LTraceTimeline from "./LTraceTimeline.vue";
import LEmpty from "../primitives/LEmpty.vue";

const spans = [
  {
    id: "root",
    name: "root-span",
    startTime: 0,
    endTime: 1000,
    status: "ok",
    children: [
      {
        id: "child",
        name: "child-span",
        startTime: 100,
        endTime: 500,
        status: "error",
      },
    ],
  },
];

describe("LTraceTimeline", () => {
  it("renders nested span names", () => {
    const wrapper = mount(LTraceTimeline, { props: { spans } });
    expect(wrapper.text()).toContain("root-span");
    expect(wrapper.text()).toContain("child-span");
  });

  it("applies status color classes", () => {
    const wrapper = mount(LTraceTimeline, { props: { spans } });
    expect(wrapper.find(".bg-success").exists()).toBe(true);
    expect(wrapper.find(".bg-error").exists()).toBe(true);
  });

  it("toggles children on expand/collapse", async () => {
    const wrapper = mount(LTraceTimeline, { props: { spans } });
    expect(wrapper.text()).toContain("child-span");

    const button = wrapper.find('button[aria-label="Collapse"]');
    expect(button.exists()).toBe(true);
    await button.trigger("click");

    expect(wrapper.text()).not.toContain("child-span");

    const expandButton = wrapper.find('button[aria-label="Expand"]');
    expect(expandButton.exists()).toBe(true);
    await expandButton.trigger("click");

    expect(wrapper.text()).toContain("child-span");
  });

  it("renders empty state when no spans", () => {
    const wrapper = mount(LTraceTimeline, { props: { spans: [] } });
    expect(wrapper.findComponent(LEmpty).exists()).toBe(true);
  });

  it("emits select when a row is clicked", async () => {
    const wrapper = mount(LTraceTimeline, { props: { spans } });
    const rows = wrapper.findAll(".cursor-pointer");
    expect(rows.length).toBeGreaterThan(0);
    await rows[0].trigger("click");
    expect(wrapper.emitted("select")).toHaveLength(1);
    expect(wrapper.emitted("select")![0][0]).toMatchObject({ id: "root" });
  });

  it("respects defaultExpanded=false", () => {
    const wrapper = mount(LTraceTimeline, {
      props: { spans, defaultExpanded: false },
    });
    expect(wrapper.text()).toContain("root-span");
    expect(wrapper.text()).not.toContain("child-span");
  });

  it("accepts virtual mode without throwing", () => {
    const wrapper = mount(LTraceTimeline, {
      props: { spans, virtual: true, containerHeight: 300 },
    });
    expect(wrapper.find(".overflow-auto").exists()).toBe(true);
    expect(wrapper.find(".overflow-auto").attributes("style")).toContain("height: 300px");
  });
});
