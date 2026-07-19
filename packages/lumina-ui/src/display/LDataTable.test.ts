import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { type ColumnDef } from "@tanstack/vue-table";
import LDataTable from "./LDataTable.vue";
import LEmpty from "../primitives/LEmpty.vue";
import LPagination from "../primitives/LPagination.vue";
import LCheckbox from "../primitives/LCheckbox.vue";

interface Row {
  id: string;
  name: string;
  age: number;
}

const data: Row[] = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
];

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];

describe("LDataTable", () => {
  it("renders headers and rows", () => {
    const wrapper = mount(LDataTable, { props: { data, columns } });

    expect(wrapper.text()).toContain("Name");
    expect(wrapper.text()).toContain("Age");
    expect(wrapper.text()).toContain("Alice");
    expect(wrapper.text()).toContain("Bob");
  });

  it("renders empty state when there is no data", () => {
    const wrapper = mount(LDataTable, { props: { data: [], columns } });

    expect(wrapper.findComponent(LEmpty).exists()).toBe(true);
  });

  it("renders loading state", () => {
    const wrapper = mount(LDataTable, { props: { data: [], columns, loading: true } });

    expect(wrapper.text()).toContain("Loading...");
  });

  it("emits update:sorting when a sortable header is clicked", async () => {
    const wrapper = mount(LDataTable, { props: { data, columns } });
    const headerDiv = wrapper.find("th div");

    await headerDiv.trigger("click");

    expect(wrapper.emitted("update:sorting")).toHaveLength(1);
  });

  it("renders selection checkboxes and emits update:rowSelection", async () => {
    const wrapper = mount(LDataTable, {
      props: { data, columns, enableRowSelection: true },
    });
    const checkboxes = wrapper.findAllComponents(LCheckbox);

    expect(checkboxes.length).toBeGreaterThan(0);

    await checkboxes[1].vm.$emit("update:checked", true);

    expect(wrapper.emitted("update:rowSelection")).toBeTruthy();
  });

  it("renders pagination when total is provided", () => {
    const wrapper = mount(LDataTable, {
      props: { data, columns, total: 100, page: 1, pageSize: 10 },
    });

    expect(wrapper.findComponent(LPagination).exists()).toBe(true);
    expect(wrapper.text()).toContain("Total: 100");
  });

  it("renders virtualized container when enabled", () => {
    const wrapper = mount(LDataTable, {
      props: { data, columns, enableVirtualization: true, virtualHeight: 300 },
    });

    expect(wrapper.find('[style*="height: 300px"]').exists()).toBe(true);
    expect(wrapper.find("table").exists()).toBe(true);
  });
});
