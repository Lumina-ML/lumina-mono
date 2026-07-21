<script setup lang="ts">
import { ref, computed, h, watch } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { RouterLink, useRoute } from "vue-router";
import {
  LCard,
  LDataTable,
  LButton,
  LDialog,
  LInput,
  LTextarea,
  LSelect,
  LSkeleton,
  LEmpty,
} from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { Plus, Search, PackageOpen } from "lucide-vue-next";
import { useModels } from "@/modules/registry-model/composables/useModels";
import { RegistryService } from "@/services/registry.service";
import { useProjects } from "@/modules/project/composables/useProjects";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";
import type { RegistryModel } from "@/types/registry-model";

const toast = useToast();
const queryClient = useQueryClient();
const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

// Registry listing is project-scoped on the server today; the dashboard
// mirrors that by requiring a project selector. The user can flip
// projects from the toolbar to see other models.
const { data: projects } = useProjects();
const selectedProjectId = ref<string | null>(null);

const effectiveProjectId = computed(() => {
  if (selectedProjectId.value) return selectedProjectId.value;
  return projects.value?.items?.[0]?.id;
});

const projectOptions = computed(() =>
  (projects.value?.items ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  })),
);

const search = ref("");

const queryParams = computed(() => ({
  projectId: effectiveProjectId.value,
  limit: pageSize.value,
  offset: (page.value - 1) * pageSize.value,
}));

const { data: models, isLoading } = useModels(queryParams);

const filteredModels = computed(() => {
  const q = search.value.trim().toLowerCase();
  const items = models.value?.items ?? [];
  if (!q) return items;
  return items.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.description ?? "").toLowerCase().includes(q),
  );
});

// ── Create dialog ────────────────────────────────────────────────────
const createOpen = ref(false);
const newName = ref("");
const newDescription = ref("");
const createError = ref<string | null>(null);

function openCreate() {
  newName.value = "";
  newDescription.value = "";
  createError.value = null;
  createOpen.value = true;
}

// `/models?new=1` deep-links straight into the create dialog so an
// external "Register a model" CTA doesn't leave users stranded on an
// empty list page.
const route = useRoute();
watch(
  () => route.query.new,
  (v) => {
    if (v === "1" || v === "true") openCreate();
  },
  { immediate: true },
);

const createMutation = useMutation({
  mutationFn: () => {
    if (!effectiveProjectId.value) {
      throw new Error("Pick a project first");
    }
    if (!newName.value.trim()) {
      throw new Error("Name is required");
    }
    return RegistryService.create(effectiveProjectId.value, {
      name: newName.value.trim(),
      description: newDescription.value.trim() || undefined,
    });
  },
  onSuccess: (created) => {
    toast.success(`Model "${created.name}" registered`);
    createOpen.value = false;
    newName.value = "";
    newDescription.value = "";
    queryClient.invalidateQueries({ queryKey: ["registry-models"] });
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    createError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

const columns: ColumnDef<RegistryModel>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/models/${encodeURIComponent(row.original.name)}/versions`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
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
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Model Registry</h1>
        <p class="text-muted-foreground">
          Registered models with versioned artifacts.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
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
          placeholder="Search models…"
          style="width: 220px"
        >
          <template #prefix>
            <Search class="h-3.5 w-3.5 text-fg-tertiary" />
          </template>
        </LInput>
        <LButton size="sm" :disabled="!effectiveProjectId" @click="openCreate">
          <Plus class="mr-1 h-3 w-3" />
          Register Model
        </LButton>
      </div>
    </div>

    <LCard class="p-0">
      <LSkeleton v-if="isLoading" class="p-8" :repeat="3" />
      <LDataTable
        v-else-if="filteredModels.length > 0"
        :data="filteredModels"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="models?.total ?? 0"
      />
      <LEmpty
        v-else
        class="p-12"
        title="No registered models"
        description="Register a model to start linking artifact versions and aliases to it."
      >
        <LButton
          class="mt-2"
          :disabled="!effectiveProjectId"
          @click="openCreate"
        >
          <PackageOpen class="mr-1 h-3 w-3" />
          Register Model
        </LButton>
      </LEmpty>
    </LCard>

    <LDialog
      v-model:show="createOpen"
      title="Register a model"
      width="500px"
      @close="createError = null"
    >
      <div class="space-y-3">
        <div>
          <label
            for="reg-name"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Name <span class="text-accent-danger">*</span>
          </label>
          <LInput
            id="reg-name"
            v-model:value="newName"
            placeholder="e.g. resnet50"
            autofocus
          />
        </div>
        <div>
          <label
            for="reg-desc"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Description
          </label>
          <LTextarea
            id="reg-desc"
            v-model:value="newDescription"
            placeholder="Optional — what's this model for?"
            :rows="3"
          />
        </div>
        <div
          v-if="createError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ createError }}
        </div>
        <p class="text-[11px] text-fg-tertiary">
          Once registered, attach artifact versions from the
          <RouterLink
            to="/artifacts"
            class="font-medium text-fg-secondary underline-offset-2 hover:underline"
          >
            artifact detail page
          </RouterLink>
          (or via <code class="font-mono">lumina.log_model()</code>).
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
            Register
          </LButton>
        </div>
      </template>
    </LDialog>
  </div>
</template>