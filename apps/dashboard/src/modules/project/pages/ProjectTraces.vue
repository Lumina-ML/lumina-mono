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
  LDialog,
  LInput,
  LTextarea,
} from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { Plus } from "lucide-vue-next";
import { useTraces } from "@/modules/trace/composables/useTraces";
import { TraceService } from "@/services/trace.service";
import { useDateFormat } from "@/composables/useDateFormat";
import { useToast } from "@/composables/useToast";
import type { Trace } from "@/types/trace";

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const toast = useToast();
const projectId = computed(() => route.params.projectId as string);
const { formatDate, formatDurationMs } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const { data: traces, isLoading } = useTraces(
  computed(() => ({
    projectId: projectId.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  })),
);

function duration(t: Trace): string {
  if (!t.startTime) return "—";
  const start = new Date(t.startTime).getTime();
  const end = t.endTime ? new Date(t.endTime).getTime() : Date.now();
  return formatDurationMs(end - start);
}

const columns: ColumnDef<Trace>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/traces/${row.original.id}`,
          class: "font-medium hover:underline",
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      h(LTag, { size: "small", type: "info" }, () => row.original.status),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => duration(row.original),
  },
  {
    accessorKey: "spans",
    header: "Spans",
    cell: ({ row }) => row.original._count?.spans ?? 0,
  },
  {
    accessorKey: "startTime",
    header: "Started",
    cell: ({ row }) => formatDate(row.original.startTime),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.projectId}/traces/${row.original.id}` },
        () => h(LButton, { size: "sm" }, () => "Open"),
      ),
  },
];

// ── Manual trace creation (Roadmap §M3-3) ────────────────────────────
// The SDK exposes `start_trace(name, ...)` for hand-built spans, but
// the dashboard had no equivalent entry — only traces emitted by the
// `lumina.trace(...)` context manager showed up. This dialog lets a
// user bootstrap an empty trace from the project page, then drill into
// it to add spans / finish it manually.
const createOpen = ref(false);
const createName = ref("");
const createMetadata = ref("");
const createError = ref<string | null>(null);

function openCreate() {
  createName.value = "";
  createMetadata.value = "";
  createError.value = null;
  createOpen.value = true;
}

const createMutation = useMutation({
  mutationFn: async () => {
    let metadata: Record<string, unknown> | undefined;
    if (createMetadata.value.trim()) {
      try {
        const parsed: unknown = JSON.parse(createMetadata.value);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("metadata must be a JSON object");
        }
        metadata = parsed as Record<string, unknown>;
      } catch (e) {
        throw new Error(`Invalid metadata JSON: ${(e as Error).message}`);
      }
    }
    return TraceService.create(projectId.value, {
      name: createName.value.trim(),
      ...(metadata ? { metadata } : {}),
    });
  },
  onSuccess: (trace) => {
    toast.success(`Trace "${trace.name}" created — add spans from the detail page.`);
    createOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["traces", projectId.value] });
    router.push(`/projects/${projectId.value}/traces/${trace.id}`);
  },
  onError: (e) => {
    createError.value = (e as Error).message ?? "Unknown error";
  },
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-fg-tertiary">
        Traces emitted by the SDK's <code class="font-mono">lumina.trace()</code>
        context manager, or created manually from this page.
      </p>
      <LButton size="sm" @click="openCreate">
        <Plus class="mr-1 h-3 w-3" />
        New trace
      </LButton>
    </div>

    <LCard class="p-0">
      <LDataTable
        :data="traces?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="traces?.total ?? 0"
      />
      <div v-if="!isLoading && (traces?.items.length ?? 0) === 0" class="px-4 pb-4">
        <LEmpty
          title="No traces yet"
          description="Use Lumina's trace integration to record span timelines for runs in this project."
        >
          <LButton class="mt-2" @click="openCreate">
            <Plus class="mr-1 h-3 w-3" />
            Create your first trace
          </LButton>
        </LEmpty>
      </div>
    </LCard>

    <LDialog
      v-model:show="createOpen"
      title="New trace"
      width="480px"
      @close="createError = null"
    >
      <form class="space-y-3" @submit.prevent="createMutation.mutate()">
        <div>
          <label
            for="trace-name"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Name <span class="text-accent-danger">*</span>
          </label>
          <LInput
            id="trace-name"
            v-model:value="createName"
            placeholder="e.g. chat-completion"
            autofocus
          />
        </div>
        <div>
          <label
            for="trace-metadata"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Metadata (JSON object, optional)
          </label>
          <LTextarea
            id="trace-metadata"
            v-model:value="createMetadata"
            placeholder='e.g. {"model": "gpt-4", "user": "alice"}'
            :rows="4"
            spellcheck="false"
          />
        </div>
        <div
          v-if="createError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ createError }}
        </div>
      </form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary @click="createOpen = false">Cancel</LButton>
          <LButton
            :loading="createMutation.isPending.value"
            :disabled="!createName.trim()"
            @click="createMutation.mutate()"
          >
            Create trace
          </LButton>
        </div>
      </template>
    </LDialog>
  </div>
</template>