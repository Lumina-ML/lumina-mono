<script setup lang="ts">
import { GridLayout, WidgetRenderer } from "@lumina/ui";
import type { DashboardLayout } from "@lumina/ui";

const layout: DashboardLayout = {
  columns: 12,
  rowHeight: 80,
  gap: 16,
  widgets: [
    { id: "stats", type: "workspace-stats", x: 0, y: 0, w: 12, h: 2 },
    { id: "recent-runs", type: "recent-runs", x: 0, y: 2, w: 6, h: 4 },
    { id: "quick-start", type: "quick-start", x: 6, y: 2, w: 6, h: 4 },
  ],
};
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Workspace Overview</h1>
      <p class="text-muted-foreground">Welcome to Lumina — your AI/ML control plane.</p>
    </div>

    <GridLayout :layout="layout.widgets" :columns="layout.columns" :row-height="layout.rowHeight" :gap="layout.gap">
      <template #default="{ item }">
        <WidgetRenderer :item="item" />
      </template>
    </GridLayout>
  </div>
</template>
