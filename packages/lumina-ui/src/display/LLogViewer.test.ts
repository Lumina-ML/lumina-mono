import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LLogViewer, { type LogEntry } from "./LLogViewer.vue";
import LInput from "../primitives/LInput.vue";
import LSelect from "../primitives/LSelect.vue";
import LEmpty from "../primitives/LEmpty.vue";

const logs: LogEntry[] = [
  { timestamp: "2024-05-20T10:00:00Z", level: "INFO", message: "foo start" },
  { timestamp: "2024-05-20T10:01:00Z", level: "ERROR", message: "bar failure" },
  { timestamp: "2024-05-20T10:02:00Z", level: "DEBUG", message: "foo detail" },
];

describe("LLogViewer", () => {
  it("renders the toolbar with search, level filter, and line count", () => {
    const wrapper = mount(LLogViewer, { props: { logs } });

    expect(wrapper.findComponent(LInput).exists()).toBe(true);
    expect(wrapper.findComponent(LSelect).exists()).toBe(true);
    expect(wrapper.text()).toContain("3 lines");
  });

  it("filters by level prop", async () => {
    const wrapper = mount(LLogViewer, { props: { logs, level: "ERROR" } });

    expect(wrapper.text()).toContain("1 lines");
  });

  it("filters by search prop", async () => {
    const wrapper = mount(LLogViewer, { props: { logs, search: "foo" } });

    expect(wrapper.text()).toContain("2 lines");
  });

  it("emits update:search when the search input changes", async () => {
    const wrapper = mount(LLogViewer, { props: { logs } });
    const input = wrapper.findComponent(LInput).find("input");

    await input.setValue("bar");

    expect(wrapper.emitted("update:search")?.[0]).toEqual(["bar"]);
  });

  it("shows an empty state when there are no logs", () => {
    const wrapper = mount(LLogViewer, { props: { logs: [] } });

    expect(wrapper.findComponent(LEmpty).exists()).toBe(true);
  });

  it("shows a loading state", () => {
    const wrapper = mount(LLogViewer, { props: { logs, loading: true } });

    expect(wrapper.text()).toContain("Loading logs...");
  });
});
