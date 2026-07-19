<script setup lang="ts">
import { computed, ref, h } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  LCard,
  LDataTable,
  LButton,
  LEmpty,
  LStatusBadge,
  LDialog,
  LInput,
  LSelect,
  LSkeleton,
} from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { Plus, FlaskConical } from "lucide-vue-next";
import { useEvaluations } from "@/modules/evaluation/composables/useEvaluations";
import { RunService } from "@/services/run.service";
import { ArtifactService } from "@/services/artifact.service";
import { EvaluationService } from "@/services/evaluation.service";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Evaluation } from "@/types/evaluation";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
const { formatDate } = useDateFormat();

const projectId = computed(() => route.params.projectId as string);

const page = ref(1);
const pageSize = ref(20);

const { data: evaluations, isLoading } = useEvaluations(
  computed(() => ({
    projectId: projectId.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  })),
);

// ── Run + artifact pickers for the create dialog ─────────────────────
const { data: projectRuns } = useQuery({
  queryKey: computed(() => ["project-runs", projectId.value]),
  queryFn: () => RunService.list({ limit: 200 }),
  enabled: computed(() => !!projectId.value),
});

const { data: projectArtifacts } = useQuery({
  queryKey: computed(() => ["project-artifacts", projectId.value]),
  queryFn: () => ArtifactService.list({ projectId: projectId.value, limit: 200 }),
  enabled: computed(() => !!projectId.value),
});

const runOptions = computed(() =>
  (projectRuns.value?.items ?? []).map((r) => ({
    label: `${r.name} (${r.runId.slice(0, 8)}…)`,
    value: r.runId,
  })),
);

const artifactOptions = computed(() =>
  (projectArtifacts.value?.items ?? []).map((a) => ({
    label: `${a.name} · ${a.type}`,
    value: a.id,
  })),
);

// ── Create dialog ────────────────────────────────────────────────────
const createOpen = ref(false);
const newName = ref("");
const newRunId = ref<string | null>(null);
const newDatasetArtifactId = ref<string | null>(null);
const newModelArtifactId = ref<string | null>(null);
const createError = ref<string | null>(null);

function openCreate() {
  newName.value = "";
  newRunId.value = null;
  newDatasetArtifactId.value = null;
  newModelArtifactId.value = null;
  createError.value = null;
  createOpen.value = true;
}

const createMutation = useMutation({
  mutationFn: () => {
    if (!newName.value.trim()) {
      throw new Error("Name is required");
    }
    return EvaluationService.create(projectId.value, {
      name: newName.value.trim(),
      ...(newRunId.value ? { runId: newRunId.value } : {}),
      ...(newDatasetArtifactId.value
        ? { datasetArtifactVersionId: newDatasetArtifactId.value }
        : {}),
      ...(newModelArtifactId.value
        ? { modelArtifactVersionId: newModelArtifactId.value }
        : {}),
    });
  },
  onSuccess: (created) => {
    toast.success(`Evaluation "${created.name}" created`);
    createOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    router.push(`/projects/${projectId.value}/evaluations/${created.id}`);
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    createError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

const columns: ColumnDef<Evaluation>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/evaluations/${row.original.id}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      h(LStatusBadge, { status: row.original.status as never }),
  },
  {
    accessorKey: "runId",
    header: "Run",
    cell: ({ row }) =>
      row.original.runId
        ? h(
            RouterLink,
            {
              to: `/projects/${row.original.projectId}/runs/${row.original.runId}`,
              class: "font-mono text-xs hover:underline",
            },
            () => row.original.runId!.slice(0, 8),
          )
        : "—",
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.projectId}/evaluations/${row.original.id}` },
        () => h(LButton, { size: "sm" }, () => "View"),
      ),
  },
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-xl font-semibold tracking-tight">Evaluations</h2>
        <p class="text-sm text-fg-tertiary">
          Evaluation runs against model + dataset artifact versions.
        </p>
      </div>
      <LButton size="sm" @click="openCreate">
        <Plus class="mr-1 h-3 w-3" />
        New evaluation
      </LButton>
    </div>

    <LCard class="p-0">
      <LSkeleton v-if="isLoading" class="p-8" :repeat="3" />
      <LDataTable
        v-else-if="(evaluations?.items.length ?? 0) > 0"
        :data="evaluations?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="evaluations?.total ?? 0"
      />
      <LEmpty
        v-else
        class="p-12"
        title="No evaluations yet"
        description="Create an evaluation by picking a run and (optionally) dataset + model artifact versions."
      >
        <LButton class="mt-2" @click="openCreate">
          <FlaskConical class="mr-1 h-3 w-3" />
          Create evaluation
        </LButton>
      </LEmpty>
    </LCard>

    <LDialog
      v-model:show="createOpen"
      title="New evaluation"
      width="500px"
      @close="createError = null"
    >
      <div class="space-y-3">
        <div>
          <label
            for="eval-name"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Name <span class="text-accent-danger">*</span>
          </label>
          <LInput
            id="eval-name"
            v-model:value="newName"
            placeholder="e.g. resnet50-imagenet-val"
            autofocus
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Run (optional)
          </label>
          <LSelect
            v-model:value="newRunId"
            :options="runOptions"
            placeholder="Pick a run"
            style="width: 100%"
            clearable
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Dataset artifact (optional)
          </label>
          <LSelect
            v-model:value="newDatasetArtifactId"
            :options="artifactOptions"
            placeholder="Pick a dataset"
            style="width: 100%"
            clearable
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Model artifact (optional)
          </label>
          <LSelect
            v-model:value="newModelArtifactId"
            :options="artifactOptions"
            placeholder="Pick a model"
            style="width: 100%"
            clearable
          />
        </div>
        <div
          v-if="createError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ createError }}
        </div>
        <p class="text-[11px] text-fg-tertiary">
          The evaluation will start as <code class="font-mono">pending</code>.
          Update its status via
          <code class="font-mono">PATCH /evaluations/:id</code>
          as the eval pipeline runs.
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary @click="createOpen = false">Cancel</LButton>
          <LButton
            :loading="createMutation.isPending.value"
            :disabled="!newName.trim()"
            @click="createMutation.mutate()"
          >
            Create
          </LButton>
        </div>
      </template>
    </LDialog>
  </div>
</template>