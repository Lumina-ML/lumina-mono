import { computed, ref, watch, type MaybeRefOrGetter, type Ref } from "vue";
import { toValue } from "vue";
import type { WorkspaceSectionData } from "@/widgets/section/WorkspaceSection.vue";
import type { ChartPanelConfig } from "@/widgets/chart-panel/ChartPanel.vue";

/**
 * Per-project workspace layout. Each call to `useWorkspaceLayout(projectId)`
 * creates an independent reactive section list keyed by project id, so
 * switching between projects shows different panels without one project's
 * edits clobbering another's.
 *
 * Storage keys: `lumina:project-workspace-layout:${projectId}`. We also
 * perform a one-time best-effort migration from the pre-per-project key
 * `lumina:project-workspace-layout` for the `__demo__` project so users
 * who already customized their layout don't lose it.
 */

const LEGACY_KEY = "lumina:project-workspace-layout";
const STORAGE_KEY_PREFIX = "lumina:project-workspace-layout:";

/**
 * Starter template surfaced by `resetToTemplate()`. The default for new
 * users is empty (no panels) so they aren't locked into metric names
 * that may not exist in their project; the template is one click away.
 */
export const TEMPLATE_SECTIONS: WorkspaceSectionData[] = [
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

let legacyMigrated = false;

function migrateLegacyIfNeeded(projectId: string): boolean {
  if (legacyMigrated) return false;
  legacyMigrated = true;
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return false;
    // Only migrate once — for the `__demo__` project (the canonical
    // "first-run" project). Other projects start empty.
    if (projectId !== "__demo__") return false;
    const targetKey = `${STORAGE_KEY_PREFIX}${projectId}`;
    if (window.localStorage.getItem(targetKey)) return false;
    window.localStorage.setItem(targetKey, raw);
    window.localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function storageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function loadSectionsFor(projectId: string): WorkspaceSectionData[] {
  if (typeof window === "undefined") return [];
  try {
    // Best-effort migration from the single global key to the per-project
    // one. No-op after the first call (gated by `legacyMigrated`).
    migrateLegacyIfNeeded(projectId);
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WorkspaceSectionData[];
  } catch {
    return [];
  }
}

function persist(projectId: string, value: WorkspaceSectionData[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(value));
  } catch {
    /* quota — ignore */
  }
}

export function useWorkspaceLayout(projectId: MaybeRefOrGetter<string>) {
  // Create a fresh reactive per-instance store so two components
  // mounted simultaneously (rare, but possible on hot reload) don't
  // share a single module-scoped `ref`. Resolved eagerly via toValue.
  const projectIdRef = computed(() => toValue(projectId));
  const sections = ref<WorkspaceSectionData[]>(loadSectionsFor(projectIdRef.value));

  // Re-load when projectId changes (e.g. user navigates from project A
  // to project B while the composable is still alive). The watcher
  // tears down its previous persistence target implicitly: the
  // `persist` closure captures the new projectId.
  watch(
    projectIdRef,
    (next) => {
      sections.value = loadSectionsFor(next);
    },
    { immediate: true },
  );

  // Persist whenever the sections list changes. Captures `projectIdRef`
  // via the closure so writes always target the active project's key.
  watch(
    sections,
    (next) => {
      persist(projectIdRef.value, next);
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

  function clearLayout() {
    sections.value = [];
  }

  function resetToTemplate() {
    sections.value = structuredClone(TEMPLATE_SECTIONS);
  }

  return {
    sections: sections as Ref<WorkspaceSectionData[]>,
    addSection,
    removeSection,
    patchSection,
    addPanel,
    clearLayout,
    resetToTemplate,
  };
}