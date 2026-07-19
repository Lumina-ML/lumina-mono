<script setup lang="ts">
import { ref, watch } from "vue";
import { GridStackLayout, WidgetRenderer, LButton } from "@lumina/ui";
import type { DashboardLayout, LayoutItem } from "@lumina/ui";

const STORAGE_KEY = "lumina:workspace-layout";

const defaultLayout: DashboardLayout = {
  columns: 12,
  rowHeight: 80,
  gap: 16,
  widgets: [
    { id: "stats", type: "workspace-stats", x: 0, y: 0, w: 12, h: 2 },
    { id: "recent-runs", type: "recent-runs", x: 0, y: 2, w: 6, h: 4 },
    { id: "quick-start", type: "quick-start", x: 6, y: 2, w: 6, h: 4 },
  ],
};

function loadLayout(): LayoutItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as LayoutItem[];
    }
  } catch {
    // ignore corrupt storage
  }
  return defaultLayout.widgets;
}

const layout = ref<LayoutItem[]>(loadLayout());
const editable = ref(false);

watch(
  layout,
  (newLayout) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
  },
  { deep: true },
);

function resetLayout() {
  layout.value = defaultLayout.widgets.map((item) => ({ ...item }));
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Workspace Overview</h1>
        <p class="text-muted-foreground">Welcome to Lumina — your AI/ML control plane.</p>
      </div>
      <div class="flex gap-2">
        <LButton size="sm" @click="editable = !editable">
          {{ editable ? "Done" : "Edit Layout" }}
        </LButton>
        <LButton v-if="editable" size="sm" text @click="resetLayout">
          Reset
        </LButton>
      </div>
    </div>

    <GridStackLayout
      v-model:layout="layout"
      :columns="defaultLayout.columns"
      :row-height="defaultLayout.rowHeight"
      :gap="defaultLayout.gap"
      :editable="editable"
    >
      <template #default="{ item }">
        <WidgetRenderer :item="item" :editable="editable" />
      </template>
    </GridStackLayout>
  </div>
</template>
