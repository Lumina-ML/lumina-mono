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
import { Plus, Waypoints } from "lucide-vue-next";
import { useSweeps } from "@/modules/sweep/composables/useSweeps";
import { SweepService } from "@/services/sweep.service";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Sweep, SweepMethod } from "@/types/sweep";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
const { formatDate } = useDateFormat();

const projectId = computed(() => route.params.projectId as string);

const page = ref(1);
const pageSize = ref(20);

const { data: sweeps, isLoading } = useSweeps(
  computed(() => ({
    projectId: projectId.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  })),
);

const methodColorMap: Record<SweepMethod, "default" | "info" | "primary"> = {
  random: "default",
  grid: "info",
  bayes: "primary",
};

// ── Create dialog ────────────────────────────────────────────────────
// A sweep's `config` mirrors the WandB sweep spec: a `metric` block plus a
// `parameters` search space. We seed the textarea with a runnable template
// so the user isn't staring at a blank JSON box.
const DEFAULT_CONFIG = `{
  "metric": { "name": "val/loss", "goal": "minimize" },
  "parameters": {
    "learning_rate": { "min": 0.0001, "max": 0.1 },
    "batch_size": { "values": [16, 32, 64] }
  }
}`;

const methodOptions: { label: string; value: SweepMethod }[] = [
  { label: "Random", value: "random" },
  { label: "Grid", value: "grid" },
  { label: "Bayesian", value: "bayes" },
];

const createOpen = ref(false);
const newName = ref("");
const newMethod = ref<SweepMethod>("random");
const newConfigText = ref(DEFAULT_CONFIG);
const createError = ref<string | null>(null);

function openCreate() {
  newName.value = "";
  newMethod.value = "random";
  newConfigText.value = DEFAULT_CONFIG;
  createError.value = null;
  createOpen.value = true;
}

const createMutation = useMutation({
  mutationFn: () => {
    if (!newName.value.trim()) {
      throw new Error("Name is required");
    }
    let config: Record<string, unknown>;
    try {
      const parsed = JSON.parse(newConfigText.value.trim() || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Config must be a JSON object");
      }
      config = parsed as Record<string, unknown>;
    } catch (e) {
      throw new Error(`Invalid config JSON: ${(e as Error).message}`);
    }
    return SweepService.create(projectId.value, {
      name: newName.value.trim(),
      method: newMethod.value,
      config,
    });
  },
  onSuccess: (created) => {
    toast.success(`Sweep "${created.name}" created`);
    createOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["sweeps"] });
    router.push(`/projects/${projectId.value}/sweeps/${created.id}`);
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    createError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

const columns: ColumnDef<Sweep>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/sweeps/${row.original.id}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) => row.original.state,
  },
  {
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) =>
      h(
        LTag,
        { size: "small", type: methodColorMap[row.original.method] },
        () => row.original.method,
      ),
  },
  {
    accessorKey: "bestRunId",
    header: "Best Run",
    cell: ({ row }) => (row.original.bestRunId ? "✓" : "—"),
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
        {
          to: `/projects/${row.original.projectId}/sweeps/${row.original.id}`,
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
        <h2 class="text-xl font-semibold tracking-tight">Sweeps</h2>
        <p class="text-sm text-fg-tertiary">
          Hyperparameter search jobs across multiple runs.
        </p>
      </div>
      <LButton size="sm" @click="openCreate">
        <Plus class="mr-1 h-3 w-3" />
        New sweep
      </LButton>
    </div>

    <LCard class="p-0">
      <LSkeleton v-if="isLoading" class="p-8" :repeat="3" />
      <LDataTable
        v-else-if="(sweeps?.items.length ?? 0) > 0"
        :data="sweeps?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="sweeps?.total ?? 0"
      />
      <LEmpty
        v-else
        class="p-12"
        title="No sweeps yet"
        description="Sweeps run hyperparameter search jobs across multiple runs."
      >
        <LButton class="mt-2" @click="openCreate">
          <Waypoints class="mr-1 h-3 w-3" />
          Create sweep
        </LButton>
      </LEmpty>
    </LCard>

    <LDialog
      v-model:show="createOpen"
      title="New sweep"
      width="560px"
      @close="createError = null"
    >
      <div class="space-y-3">
        <div>
          <label
            for="sweep-name"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Name <span class="text-accent-danger">*</span>
          </label>
          <LInput
            id="sweep-name"
            v-model:value="newName"
            placeholder="e.g. lr-search-resnet50"
            autofocus
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Method
          </label>
          <LSelect
            v-model:value="newMethod"
            :options="methodOptions"
            style="width: 100%"
          />
        </div>
        <div>
          <label
            for="sweep-config"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Config (JSON)
          </label>
          <LTextarea
            id="sweep-config"
            v-model:value="newConfigText"
            :rows="9"
            class="font-mono"
          />
          <p class="mt-1 text-[11px] text-fg-tertiary">
            A <code class="font-mono">metric</code> block and a
            <code class="font-mono">parameters</code> search space. The agent
            reads this via <code class="font-mono">lumina.agent(sweep_id)</code>.
          </p>
        </div>
        <div
          v-if="createError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ createError }}
        </div>
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
