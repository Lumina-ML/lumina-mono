<script setup lang="ts">
import { computed, ref } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  LCard,
  LSkeleton,
  LButton,
  LEmpty,
  LInput,
  LSelect,
  LStatistic,
  LDialog,
} from "@lumina/ui";
import {
  Plus,
  ListOrdered,
  Search,
} from "lucide-vue-next";
import { useProjects } from "@/modules/project/composables/useProjects";
import { useLaunchQueues } from "@/modules/launch/composables/useLaunch";
import { LaunchService } from "@/services/launch.service";
import { useToast } from "@/composables/useToast";
import QueueRow from "@/modules/launch/pages/QueueRow.vue";

const toast = useToast();
const queryClient = useQueryClient();

const { data: projects } = useProjects();
const selectedProjectId = ref<string | null>(null);

const effectiveProjectId = computed(() => {
  if (selectedProjectId.value) return selectedProjectId.value;
  return projects.value?.items?.[0]?.id;
});

const { data: queues, isLoading } = useLaunchQueues(effectiveProjectId);

const totalRuns = computed(
  () =>
    queues.value?.items.reduce((a, q) => a + (q._count?.runs ?? 0), 0) ?? 0,
);

const createOpen = ref(false);
const newQueueName = ref("");
const createMutation = useMutation({
  mutationFn: () =>
    LaunchService.createQueue(effectiveProjectId.value!, {
      name: newQueueName.value.trim(),
    }),
  onSuccess: () => {
    toast.success("Queue created");
    createOpen.value = false;
    newQueueName.value = "";
    queryClient.invalidateQueries({ queryKey: ["launch-queues"] });
  },
  onError: (e) => toast.error(`Failed: ${(e as Error).message}`),
});

const projectOptions = computed(() =>
  (projects.value?.items ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  })),
);

const search = ref("");
const filteredQueues = computed(() => {
  const q = search.value.trim().toLowerCase();
  const items = queues.value?.items ?? [];
  if (!q) return items;
  return items.filter(
    (x) =>
      x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q),
  );
});
</script>

<template>
  <div class="space-y-6">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <LSelect
          v-model:value="selectedProjectId"
          :options="projectOptions"
          placeholder="Pick a project"
          style="width: 220px"
          clearable
        />
        <LInput
          v-model:value="search"
          size="small"
          placeholder="Search queues…"
          style="width: 200px"
        >
          <template #prefix>
            <Search class="h-3.5 w-3.5 text-fg-tertiary" />
          </template>
        </LInput>
      </div>
      <LButton
        size="sm"
        :disabled="!effectiveProjectId"
        @click="createOpen = true"
      >
        <Plus class="mr-1 h-3 w-3" />
        New queue
      </LButton>
    </div>

    <!-- Stats -->
    <div class="grid gap-3 sm:grid-cols-3">
      <LCard class="p-4">
        <LStatistic
          label="Queues"
          :value="String(queues?.items.length ?? 0)"
        />
      </LCard>
      <LCard class="p-4">
        <LStatistic label="Total runs" :value="String(totalRuns)" />
      </LCard>
      <LCard class="p-4">
        <LStatistic
          label="Project"
          :value="
            projects?.items.find((p) => p.id === effectiveProjectId)?.name ??
            '—'
          "
        />
      </LCard>
    </div>

    <!-- Queues list -->
    <LCard class="p-0">
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <ListOrdered class="h-4 w-4 text-fg-tertiary" />
        <h3 class="text-sm font-medium">Queues</h3>
        <span class="font-mono text-xs text-fg-tertiary">
          {{ filteredQueues.length }}
        </span>
      </div>

      <LSkeleton v-if="isLoading" class="p-8" :repeat="3" />

      <LEmpty
        v-else-if="filteredQueues.length === 0"
        class="p-12"
        title="No launch queues"
        description="Create a queue to enqueue jobs for remote agents."
      >
        <LButton
          class="mt-2"
          :disabled="!effectiveProjectId"
          @click="createOpen = true"
        >
          <Plus class="mr-1 h-3 w-3" />
          Create queue
        </LButton>
      </LEmpty>

      <ul v-else class="divide-y divide-border">
        <li v-for="q in filteredQueues" :key="q.id" class="px-4 py-3">
          <QueueRow :queue="q" />
        </li>
      </ul>
    </LCard>

    <!-- Create dialog -->
    <LDialog v-model:show="createOpen" title="New launch queue" width="420px">
      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Name
          </label>
          <LInput
            v-model:value="newQueueName"
            placeholder="e.g. training-default"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary @click="createOpen = false">Cancel</LButton>
          <LButton
            :loading="createMutation.isPending.value"
            :disabled="!newQueueName.trim()"
            @click="createMutation.mutate()"
          >
            Create
          </LButton>
        </div>
      </template>
    </LDialog>
  </div>
</template>