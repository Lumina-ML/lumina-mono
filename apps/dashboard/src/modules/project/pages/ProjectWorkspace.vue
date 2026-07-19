<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import { useProject } from "@/modules/project/composables/useProjects";
import { useRuns } from "@/modules/run/composables/useRuns";
import { useDateFormat } from "@/composables/useDateFormat";
import { useRealtimeSubscription } from "@/composables/useRealtimeSubscription";
import { useWorkspaceLayout } from "@/composables/useWorkspaceLayout";
import RunSelector from "@/widgets/run-selector/RunSelector.vue";
import WorkspaceSection from "@/widgets/section/WorkspaceSection.vue";
import { Plus, RotateCcw } from "lucide-vue-next";
import { LCard, LEmpty, LButton, LIconButton, LTooltip } from "@lumina/ui";
import RunStatusBadge from "@/widgets/run-status-badge/RunStatusBadge.vue";
import type { RunStatus } from "@/types/run";

const route = useRoute();
const queryClient = useQueryClient();
const projectId = computed(() => route.params.projectId as string);
const { data: project } = useProject(projectId);
const { formatDate } = useDateFormat();

const { data: runsResponse } = useRuns(
  computed(() => ({
    project: project.value?.name,
    limit: 200,
    offset: 0,
  })),
);

const runs = computed(() => runsResponse.value?.items ?? []);

useRealtimeSubscription(
  computed(() => `project:${projectId.value}`),
  (event) => {
    switch (event.type) {
      case "RunCreated":
        queryClient.invalidateQueries({ queryKey: ["runs"] });
        break;
      case "ArtifactUploaded":
        queryClient.invalidateQueries({ queryKey: ["artifacts"] });
        break;
      default:
        break;
    }
  },
);

// ── Run selector state ──────────────────────────────────────────────────
const selectedRunIds = ref<string[]>([]);
const hiddenRunIds = ref<string[]>([]);
const pinnedRunIds = ref<string[]>([]);
const statusFilter = ref<RunStatus | null>(null);

// Visible runs: not hidden. Chart panels subscribe to selectedRunIds only.
const visibleRuns = computed(() =>
  runs.value.filter((r) => !hiddenRunIds.value.includes(r.runId)),
);
const chartRunIds = computed(() =>
  selectedRunIds.value.length > 0 ? selectedRunIds.value : visibleRuns.value.map((r) => r.runId),
);

// ── Workspace layout (sections + panels) ───────────────────────────────
const {
  sections,
  addSection,
  removeSection,
  patchSection,
  addPanel,
  resetLayout,
} = useWorkspaceLayout();

const visibleSections = computed(() => sections.value.filter((s) => !s.hidden));

function onAddSection() {
  const name = window.prompt("Section name", "New section");
  if (name && name.trim()) addSection(name.trim());
}

function onAddPanel(sectionId: string) {
  const title = window.prompt("Panel title", "New chart");
  const keys = window.prompt(
    "Metric keys (comma-separated)",
    "train/loss,val/loss",
  );
  const metricKeys = keys
    ? keys.split(",").map((k) => k.trim()).filter(Boolean)
    : [];
  addPanel(sectionId, { title: title ?? "New chart", metricKeys });
}

// Header metrics
const totals = computed(() => ({
  runs: runsResponse.value?.total ?? runs.value.length,
  selected: selectedRunIds.value.length,
  visible: visibleRuns.value.length,
}));
</script>

<template>
  <div class="-mx-4 -my-4 flex h-[calc(100%+2rem)] min-h-0 md:-mx-6">
    <!-- Left: Run selector -->
    <div class="hidden w-[300px] flex-shrink-0 lg:block">
      <RunSelector
        :runs="runs"
        :selected-run-ids="selectedRunIds"
        :hidden-run-ids="hiddenRunIds"
        :pinned-run-ids="pinnedRunIds"
        v-model:status-filter="statusFilter"
        @update:selected-run-ids="(v: string[]) => (selectedRunIds = v)"
        @update:hidden-run-ids="(v: string[]) => (hiddenRunIds = v)"
        @update:pinned-run-ids="(v: string[]) => (pinnedRunIds = v)"
      />
    </div>

    <!-- Right: workspace content -->
    <div class="min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
      <!-- Stat row -->
      <div class="mb-6 grid gap-3 sm:grid-cols-3">
        <LCard class="p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
            Runs
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="font-mono text-2xl">{{ totals.runs }}</span>
            <span v-if="totals.selected > 0" class="font-mono text-xs text-accent-primary">
              · {{ totals.selected }} selected
            </span>
          </div>
        </LCard>
        <LCard class="p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
            Visible
          </div>
          <div class="mt-2 font-mono text-2xl">{{ totals.visible }}</div>
        </LCard>
        <LCard class="p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
            Panels
          </div>
          <div class="mt-2 font-mono text-2xl">
            {{ sections.reduce((n, s) => n + s.panels.length, 0) }}
          </div>
        </LCard>
      </div>

      <!-- Recent runs (mobile fallback — sidebar is hidden < lg) -->
      <LCard v-if="runs.length > 0" title="Recent Runs" class="mb-6 p-0">
        <ul class="divide-y divide-border">
          <li
            v-for="run in runs.slice(0, 5)"
            :key="run.id"
            class="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-canvas lg:hidden"
          >
            <div class="flex items-center gap-3">
              <RunStatusBadge :status="run.status" />
              <RouterLink
                :to="`/projects/${projectId}/runs/${run.runId}`"
                class="font-medium hover:underline"
              >
                {{ run.name }}
              </RouterLink>
            </div>
            <span class="font-mono text-xs text-fg-tertiary">
              {{ formatDate(run.createdAt) }}
            </span>
          </li>
          <li
            v-for="run in runs.slice(0, 5)"
            :key="`d-${run.id}`"
            class="hidden items-center justify-between px-4 py-2.5 text-sm hover:bg-canvas lg:flex"
          >
            <div class="flex items-center gap-3">
              <RunStatusBadge :status="run.status" />
              <span class="text-fg-tertiary">
                Open the left sidebar to select runs for the panels below.
              </span>
            </div>
          </li>
        </ul>
      </LCard>

      <!-- Sections toolbar -->
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-fg-tertiary">
          Workspace
        </h2>
        <div class="flex items-center gap-2">
          <LButton size="sm" @click="onAddSection">
            <Plus class="mr-1 h-3 w-3" />
            Add Section
          </LButton>
          <LTooltip content="Reset to default layout">
            <LIconButton aria-label="Reset layout" @click="resetLayout">
              <RotateCcw class="h-4 w-4" />
            </LIconButton>
          </LTooltip>
        </div>
      </div>

      <!-- Section grid -->
      <div v-if="visibleSections.length > 0" class="space-y-8">
        <WorkspaceSection
          v-for="section in visibleSections"
          :key="section.id"
          :section="section"
          :run-ids="chartRunIds"
          @update:section="(next) => patchSection(section.id, next)"
          @remove="removeSection(section.id)"
          @add-panel="onAddPanel(section.id)"
        />
      </div>

      <LCard v-else class="p-8">
        <LEmpty
          title="No sections yet"
          description="Add a section to start building your workspace. Each section groups related charts."
        >
          <LButton class="mt-3" @click="onAddSection">
            <Plus class="mr-1 h-3 w-3" />
            Add Section
          </LButton>
        </LEmpty>
      </LCard>
    </div>
  </div>
</template>