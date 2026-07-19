import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LRunStatus from "./LRunStatus.vue";

describe("LRunStatus", () => {
  it.each([
    ["pending", "Pending"],
    ["running", "Running"],
    ["finished", "Finished"],
    ["failed", "Failed"],
    ["crashed", "Crashed"],
    ["killed", "Killed"],
    ["preempting", "Preempting"],
    ["preempted", "Preempted"],
  ])("renders %s as %s", (status, text) => {
    const wrapper = mount(LRunStatus, { props: { status } });
    expect(wrapper.text()).toContain(text);
  });

  it("falls back to raw status for unknown", () => {
    const wrapper = mount(LRunStatus, { props: { status: "custom-state" } });
    expect(wrapper.text()).toContain("custom-state");
  });
});
