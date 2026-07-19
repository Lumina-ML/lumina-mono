<script setup lang="ts">
import { computed, h } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  LCard,
  LTag,
  LButton,
  LSkeleton,
  LEmpty,
  LDataTable,
} from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { ArrowLeft, Pause, Play, Square } from "lucide-vue-next";
import { useSweep } from "@/modules/sweep/composables/useSweeps";
import { RunService } from "@/services/run.service";
import { useDateFormat } from "@/composables/useDateFormat";
import RunStatusBadge from "@/widgets/run-status-badge/RunStatusBadge.vue";
import type { Run } from "@/types/run";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const sweepId = computed(() => route.params.sweepId as string);
const { formatDate, formatDurationMs } = useDateFormat();

const { data: sweep, isLoading } = useSweep(sweepId);

const { data: sweepRuns } = useQuery({
  queryKey: computed(() => ["sweep-runs", sweepId.value]),
  queryFn: async () => {
    // Backend doesn't expose ?sweepId= filter on runs yet — fall back to
    // fetching the project's runs and filtering client-side by sweepId.
    if (!sweep.value?.projectId) return [] as Run[];
    const resp = await RunService.list({
      project: undefined,
      limit: 200,
      offset: 0,
    });
    return resp.items.filter((r) => r.sweepId === sweepId.value);
  },
  enabled: computed(() => !!sweep.value?.projectId),
});

const totalRuns = computed(() => sweepRuns.value?.length ?? 0);

const columns: ColumnDef<Run>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => h(RunStatusBadge, { status: row.original.status }),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/runs/${row.original.runId}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => {
      if (!row.original.finishedAt) return "—";
      return formatDurationMs(
        new Date(row.original.finishedAt).getTime() -
          new Date(row.original.createdAt).getTime(),
      );
    },
  },
];
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="`/projects/${projectId}/sweeps`"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to sweeps
    </RouterLink>

    <LSkeleton v-if="isLoading" text :repeat="3" />

    <template v-else-if="sweep">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">{{ sweep.name }}</h1>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-fg-tertiary">
            <LTag size="small" :type="sweep.state === 'running' ? 'warning' : sweep.state === 'finished' ? 'success' : 'default'">
              {{ sweep.state }}
            </LTag>
            <LTag size="small" type="info">{{ sweep.method }}</LTag>
            <span>{{ totalRuns }} runs</span>
            <span>Created {{ formatDate(sweep.createdAt) }}</span>
          </div>
        </div>
        <div class="flex gap-2">
          <LButton size="sm" :disabled="sweep.state !== 'running'">
            <Pause class="mr-1 h-3 w-3" />
            Pause
          </LButton>
          <LButton size="sm" :disabled="sweep.state === 'running'">
            <Play class="mr-1 h-3 w-3" />
            Resume
          </LButton>
          <LButton size="sm" :disabled="sweep.state === 'finished'">
            <Square class="mr-1 h-3 w-3" />
            Stop
          </LButton>
        </div>
      </div>

      <LCard title="Sweep Config" class="p-4">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-md border border-border p-3">
            <div class="text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
              Method
            </div>
            <div class="mt-1 font-mono text-sm">{{ sweep.method }}</div>
          </div>
          <div class="rounded-md border border-border p-3">
            <div class="text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
              Best Run
            </div>
            <div class="mt-1 font-mono text-sm">
              {{ sweep.bestRunId ? "✓ Set" : "—" }}
            </div>
          </div>
          <div class="rounded-md border border-border p-3">
            <div class="text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
              Total Runs
            </div>
            <div class="mt-1 font-mono text-sm">{{ totalRuns }}</div>
          </div>
        </div>
      </LCard>

      <LCard title="Runs" class="p-0">
        <LDataTable
          v-if="sweepRuns && sweepRuns.length > 0"
          :data="sweepRuns"
          :columns="columns"
        />
        <div v-else class="p-8">
          <LEmpty
            title="No runs yet"
            description="This sweep hasn't produced any runs yet."
          />
        </div>
      </LCard>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Sweep not found.
    </LCard>
  </div>
</template>