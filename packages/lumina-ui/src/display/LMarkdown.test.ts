import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LMarkdown from "./LMarkdown.vue";

describe("LMarkdown", () => {
  it("renders markdown as HTML", () => {
    const wrapper = mount(LMarkdown, {
      props: { source: "# Hello\n\nThis is **bold** text." },
    });

    expect(wrapper.find("h1").exists()).toBe(true);
    expect(wrapper.find("h1").text()).toBe("Hello");
    expect(wrapper.find("strong").exists()).toBe(true);
    expect(wrapper.find("strong").text()).toBe("bold");
  });

  it("sanitizes dangerous HTML by default", () => {
    const wrapper = mount(LMarkdown, {
      props: { source: "<script>alert('xss')</script><p>safe</p>" },
    });

    expect(wrapper.find("script").exists()).toBe(false);
    expect(wrapper.find("p").exists()).toBe(true);
    expect(wrapper.find("p").text()).toBe("safe");
  });

  it("passes raw HTML through when sanitize is disabled", () => {
    const wrapper = mount(LMarkdown, {
      props: {
        source: "<mark>highlighted</mark>",
        sanitize: false,
      },
    });

    expect(wrapper.find("mark").exists()).toBe(true);
    expect(wrapper.find("mark").text()).toBe("highlighted");
  });

  it("renders empty content without errors", () => {
    const wrapper = mount(LMarkdown, { props: { source: "" } });
    expect(wrapper.text()).toBe("");
  });
});
