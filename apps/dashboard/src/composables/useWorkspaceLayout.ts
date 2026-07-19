import { ref, watch } from "vue";
import type { WorkspaceSectionData } from "@/widgets/section/WorkspaceSection.vue";
import type { ChartPanelConfig } from "@/widgets/chart-panel/ChartPanel.vue";

const STORAGE_KEY = "lumina:project-workspace-layout";

const DEFAULT_SECTIONS: WorkspaceSectionData[] = [
  {
    id: "training",
    name: "Training Metrics",
    collapsed: false,
    hidden: false,
    panels: [
      {
        id: "loss",
        config: {
          title: "Training Loss",
          metricKeys: ["train/loss", "loss"],
        },
      },
      {
        id: "acc",
        config: {
          title: "Validation Accuracy",
          metricKeys: ["val/accuracy", "val/acc"],
        },
      },
    ],
  },
  {
    id: "system",
    name: "System Metrics",
    collapsed: false,
    hidden: false,
    panels: [
      {
        id: "gpu",
        config: { title: "GPU Utilization", metricKeys: ["gpu/util"] },
      },
      {
        id: "cpu",
        config: { title: "CPU & Memory", metricKeys: ["cpu/util", "memory/used"] },
      },
    ],
  },
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSections(): WorkspaceSectionData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SECTIONS);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return structuredClone(DEFAULT_SECTIONS);
    return parsed as WorkspaceSectionData[];
  } catch {
    return structuredClone(DEFAULT_SECTIONS);
  }
}

const sections = ref<WorkspaceSectionData[]>(loadSections());

watch(
  sections,
  (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota — ignore */
    }
  },
  { deep: true },
);

function addSection(name: string) {
  sections.value.push({
    id: uid("section"),
    name,
    collapsed: false,
    hidden: false,
    panels: [],
  });
}

function removeSection(id: string) {
  sections.value = sections.value.filter((s) => s.id !== id);
}

function patchSection(id: string, next: WorkspaceSectionData) {
  sections.value = sections.value.map((s) => (s.id === id ? next : s));
}

function addPanel(sectionId: string, config?: Partial<ChartPanelConfig>) {
  sections.value = sections.value.map((s) => {
    if (s.id !== sectionId) return s;
    const panelConfig: ChartPanelConfig = {
      title: config?.title ?? "New chart",
      metricKeys: config?.metricKeys ?? [],
      smoothing: config?.smoothing,
    };
    return {
      ...s,
      panels: [...s.panels, { id: uid("panel"), config: panelConfig }],
    };
  });
}

function resetLayout() {
  sections.value = structuredClone(DEFAULT_SECTIONS);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function useWorkspaceLayout() {
  return {
    sections,
    addSection,
    removeSection,
    patchSection,
    addPanel,
    resetLayout,
  };
}