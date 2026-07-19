<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { LCard, LButton, LSelect, LEmpty } from "@lumina/ui";
import { useProject } from "@/modules/project/composables/useProjects";
import { useRuns } from "@/modules/run/composables/useRuns";
import RunTable from "@/widgets/run-table/RunTable.vue";
import type { RunStatus } from "@/types/run";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);

const { data: project } = useProject(projectId);

const page = ref(1);
const pageSize = ref(20);
const statusFilter = ref<RunStatus | null>(null);

const runsQuery = computed(() => ({
  project: project.value?.name,
  status: statusFilter.value ?? undefined,
  limit: pageSize.value,
  offset: (page.value - 1) * pageSize.value,
}));

const { data: runsResponse, isLoading, refetch } = useRuns(runsQuery);

watch(projectId, () => {
  page.value = 1;
  statusFilter.value = null;
});

const statusOptions = [
  { label: "All", value: "" },
  { label: "Running", value: "running" },
  { label: "Finished", value: "finished" },
  { label: "Failed", value: "failed" },
  { label: "Crashed", value: "crashed" },
  { label: "Killed", value: "killed" },
  { label: "Pending", value: "pending" },
];
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-end gap-2">
      <LSelect
        v-model:value="statusFilter"
        :options="statusOptions"
        placeholder="Filter by status"
        clearable
        style="width: 160px"
      />
      <LButton @click="refetch()">Refresh</LButton>
    </div>

    <LCard class="p-0">
      <RunTable
        :runs="runsResponse?.items ?? []"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="runsResponse?.total ?? 0"
      />
      <div
        v-if="!isLoading && (runsResponse?.items.length ?? 0) === 0"
        class="px-4 pb-4"
      >
        <LEmpty
          title="No runs match these filters"
          description="Adjust the status filter or start a new run."
        />
      </div>
    </LCard>
  </div>
</template>