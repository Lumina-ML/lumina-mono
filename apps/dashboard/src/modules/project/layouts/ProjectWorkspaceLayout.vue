<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter, RouterView } from "vue-router";
import { LButton } from "@lumina/ui";
import {
  LayoutDashboard,
  Play,
  GitBranch,
  Package,
  FileText,
  Rocket,
  Settings as SettingsIcon,
  Activity,
} from "lucide-vue-next";
import { useProject } from "@/modules/project/composables/useProjects";
import { useRuns } from "@/modules/run/composables/useRuns";
import { useSweeps } from "@/modules/sweep/composables/useSweeps";
import { useArtifacts } from "@/modules/artifact/composables/useArtifacts";
import { useReports } from "@/modules/report/composables/useReports";
import { useEvaluations } from "@/modules/evaluation/composables/useEvaluations";

const route = useRoute();
const router = useRouter();

const projectId = computed(() => route.params.projectId as string);
const { data: project } = useProject(projectId);

const { data: runsResponse } = useRuns(
  computed(() => ({ project: projectId.value, limit: 1, offset: 0 })),
);
const { data: sweepsResponse } = useSweeps(
  computed(() => ({ projectId: projectId.value, limit: 1, offset: 0 })),
);
const { data: artifactsResponse } = useArtifacts(
  computed(() => ({ projectId: projectId.value, limit: 1, offset: 0 })),
);
const { data: reportsResponse } = useReports(
  computed(() => ({ projectId: projectId.value, limit: 1, offset: 0 })),
);
const { data: evaluationsResponse } = useEvaluations(
  computed(() => ({ projectId: projectId.value, limit: 1, offset: 0 })),
);

interface TabDef {
  key: string;
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  count?: () => number | undefined;
}

const tabs = computed<TabDef[]>(() => [
  {
    key: "overview",
    label: "Overview",
    to: `/projects/${projectId.value}`,
    icon: LayoutDashboard,
  },
  {
    key: "runs",
    label: "Runs",
    to: `/projects/${projectId.value}/runs`,
    icon: Play,
    count: () => runsResponse.value?.total,
  },
  {
    key: "sweeps",
    label: "Sweeps",
    to: `/projects/${projectId.value}/sweeps`,
    icon: GitBranch,
    count: () => sweepsResponse.value?.total,
  },
  {
    key: "artifacts",
    label: "Artifacts",
    to: `/projects/${projectId.value}/artifacts`,
    icon: Package,
    count: () => artifactsResponse.value?.total,
  },
  {
    key: "reports",
    label: "Reports",
    to: `/projects/${projectId.value}/reports`,
    icon: FileText,
    count: () => reportsResponse.value?.total,
  },
  {
    key: "evaluations",
    label: "Evaluations",
    to: `/projects/${projectId.value}/evaluations`,
    icon: Activity,
    count: () => evaluationsResponse.value?.total,
  },
  {
    key: "launch",
    label: "Launch",
    to: `/projects/${projectId.value}/launch`,
    icon: Rocket,
  },
  {
    key: "settings",
    label: "Settings",
    to: `/projects/${projectId.value}/settings`,
    icon: SettingsIcon,
  },
]);

function isActive(tab: TabDef): boolean {
  if (tab.key === "overview") {
    return (
      route.path === `/projects/${projectId.value}` ||
      route.path === `/projects/${projectId.value}/`
    );
  }
  return route.path.startsWith(tab.to);
}

function goToTab(tab: TabDef) {
  router.push(tab.to);
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- Project header -->
    <div class="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <h1 class="truncate text-2xl font-semibold tracking-tight">
          {{ project?.name ?? "Loading…" }}
        </h1>
        <p
          v-if="project?.description"
          class="mt-1 truncate text-sm text-fg-tertiary"
        >
          {{ project.description }}
        </p>
      </div>
    </div>

    <!-- Tab bar -->
    <div
      class="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-1 overflow-x-auto border-b border-border bg-background px-4 md:-mx-6 md:px-6"
    >
      <LButton
        v-for="tab in tabs"
        :key="tab.key"
        quaternary
        size="sm"
        :class="[
          '!flex !shrink-0 !items-center !gap-2 !rounded-none border-b-2 !px-3 !py-2 !text-sm',
          isActive(tab)
            ? '!border-accent-primary !font-medium !text-fg-primary'
            : '!border-transparent !text-fg-tertiary hover:!text-fg-secondary',
        ]"
        @click="goToTab(tab)"
      >
        <component :is="tab.icon" class="h-4 w-4" />
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.count?.() != null"
          class="rounded-full bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-fg-tertiary"
        >
          {{ tab.count() }}
        </span>
      </LButton>
    </div>

    <!-- Tab content -->
    <div class="min-h-0 flex-1">
      <RouterView />
    </div>
  </div>
</template>