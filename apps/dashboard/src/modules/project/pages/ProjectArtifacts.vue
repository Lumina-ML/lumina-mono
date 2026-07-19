<script setup lang="ts">
import { computed, ref, h } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  LCard,
  LTag,
  LDataTable,
  LButton,
  LEmpty,
  LSkeleton,
  LDialog,
  LInput,
  LSelect,
  LTextarea,
} from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { Plus, Package } from "lucide-vue-next";
import { useArtifacts } from "@/modules/artifact/composables/useArtifacts";
import { ArtifactService } from "@/services/artifact.service";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Artifact, ArtifactType } from "@/types/artifact";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
const { formatDate } = useDateFormat();

const projectId = computed(() => route.params.projectId as string);

const page = ref(1);
const pageSize = ref(20);

const { data: artifacts, isLoading } = useArtifacts(
  computed(() => ({
    projectId: projectId.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  })),
);

const typeVariant: Record<
  ArtifactType,
  "default" | "primary" | "info" | "success" | "warning"
> = {
  dataset: "info",
  model: "primary",
  checkpoint: "success",
  file: "default",
  table: "warning",
};

// ── Create dialog ────────────────────────────────────────────────────
// Creates the artifact shell; files/versions are added from ArtifactDetail
// (or logged from a run via the SDK).
const typeOptions: { label: string; value: ArtifactType }[] = [
  { label: "Dataset", value: "dataset" },
  { label: "Model", value: "model" },
  { label: "Checkpoint", value: "checkpoint" },
  { label: "File", value: "file" },
  { label: "Table", value: "table" },
];

const createOpen = ref(false);
const newName = ref("");
const newType = ref<ArtifactType>("model");
const newDescription = ref("");
const createError = ref<string | null>(null);

function openCreate() {
  newName.value = "";
  newType.value = "model";
  newDescription.value = "";
  createError.value = null;
  createOpen.value = true;
}

const createMutation = useMutation({
  mutationFn: () => {
    if (!newName.value.trim()) {
      throw new Error("Name is required");
    }
    return ArtifactService.create(projectId.value, {
      name: newName.value.trim(),
      type: newType.value,
      ...(newDescription.value.trim()
        ? { description: newDescription.value.trim() }
        : {}),
    });
  },
  onSuccess: (created) => {
    toast.success(`Artifact "${created.name}" created`);
    createOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["artifacts"] });
    router.push(`/projects/${projectId.value}/artifacts/${created.id}`);
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    createError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

const columns: ColumnDef<Artifact>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/artifacts/${row.original.id}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) =>
      h(
        LTag,
        { size: "small", type: typeVariant[row.original.type] },
        () => row.original.type,
      ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "—",
  },
  {
    accessorKey: "versions",
    header: "Versions",
    cell: ({ row }) => row.original._count?.versions ?? 0,
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => formatDate(row.original.updatedAt),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/artifacts/${row.original.id}`,
        },
        () => h(LButton, { size: "sm" }, () => "View"),
      ),
  },
];
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-xl font-semibold tracking-tight">Artifacts</h2>
        <p class="text-sm text-fg-tertiary">
          Versioned datasets, models, and files.
        </p>
      </div>
      <LButton size="sm" @click="openCreate">
        <Plus class="mr-1 h-3 w-3" />
        New artifact
      </LButton>
    </div>

    <LCard class="p-0">
      <LSkeleton v-if="isLoading" class="p-8" :repeat="3" />
      <LDataTable
        v-else-if="(artifacts?.items.length ?? 0) > 0"
        :data="artifacts?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="artifacts?.total ?? 0"
      />
      <LEmpty
        v-else
        class="p-12"
        title="No artifacts yet"
        description="Log artifacts from your runs, or create one here and add files from its detail page."
      >
        <LButton class="mt-2" @click="openCreate">
          <Package class="mr-1 h-3 w-3" />
          Create artifact
        </LButton>
      </LEmpty>
    </LCard>

    <LDialog
      v-model:show="createOpen"
      title="New artifact"
      width="500px"
      @close="createError = null"
    >
      <div class="space-y-3">
        <div>
          <label
            for="artifact-name"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Name <span class="text-accent-danger">*</span>
          </label>
          <LInput
            id="artifact-name"
            v-model:value="newName"
            placeholder="e.g. imagenet-val"
            autofocus
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Type
          </label>
          <LSelect
            v-model:value="newType"
            :options="typeOptions"
            style="width: 100%"
          />
        </div>
        <div>
          <label
            for="artifact-desc"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Description
          </label>
          <LTextarea
            id="artifact-desc"
            v-model:value="newDescription"
            :rows="3"
            placeholder="Optional"
          />
        </div>
        <div
          v-if="createError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ createError }}
        </div>
        <p class="text-[11px] text-fg-tertiary">
          Creates an empty artifact. Add files and cut a version from its
          detail page, or log to it from a run via the SDK.
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
