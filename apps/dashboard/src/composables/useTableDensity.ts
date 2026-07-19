import { computed, ref } from "vue";

export type TableDensity = "compact" | "standard" | "comfortable";

const STORAGE_KEY = "lumina:table-density";

function load(): TableDensity {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "compact" || raw === "standard" || raw === "comfortable") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "standard";
}

const density = ref<TableDensity>(load());

function set(next: TableDensity) {
  density.value = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

export function useTableDensity() {
  const classes = computed(() => {
    switch (density.value) {
      case "compact":
        return {
          row: "py-1 text-xs",
          cell: "px-2",
          header: "py-1.5 text-xs",
        };
      case "comfortable":
        return {
          row: "py-3 text-sm",
          cell: "px-4",
          header: "py-3 text-sm",
        };
      default:
        return {
          row: "py-2 text-sm",
          cell: "px-3",
          header: "py-2 text-sm",
        };
    }
  });
  return { density, set, classes };
}