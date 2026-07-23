<script setup lang="ts">
import { computed, ref, h } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { LCard, LDataTable, LButton, LEmpty, LDialog, LInput, LSkeleton } from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { Plus } from "lucide-vue-next";
import { useReports } from "@/modules/report/composables/useReports";
import { ReportService } from "@/services/report.service";
import { useDateFormat } from "@/composables/useDateFormat";
import { useToast } from "@/composables/useToast";
import type { Report } from "@/types/report";

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const toast = useToast();
const projectId = computed(() => route.params.projectId as string);
const { formatDate } = useDateFormat();

const createOpen = ref(false);
const newTitle = ref("");
const createError = ref<string | null>(null);

const createMutation = useMutation({
  mutationFn: () =>
    ReportService.create(projectId.value, {
      title: newTitle.value.trim(),
      blocks: [],
    }),
  onSuccess: (report) => {
    toast.success("Report created");
    createOpen.value = false;
    newTitle.value = "";
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    router.push(`/projects/${projectId.value}/reports/${report.id}/edit`);
  },
  onError: (e) => {
    createError.value = (e as Error).message ?? "Unknown error";
  },
});

function submitCreate() {
  createError.value = null;
  if (!newTitle.value.trim()) {
    createError.value = "Title is required";
    return;
  }
  createMutation.mutate();
}

const page = ref(1);
const pageSize = ref(20);

const { data: reports, isLoading } = useReports(
  computed(() => ({
    projectId: projectId.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
  })),
);

const columns: ColumnDef<Report>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: `/projects/${row.original.projectId}/reports/${row.original.id}`,
          class: "font-medium hover:underline",
        },
        () => row.original.title,
      ),
  },
  {
    accessorKey: "createdBy",
    header: "Author",
    cell: ({ row }) => row.original.createdBy || "—",
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
          to: `/projects/${row.original.projectId}/reports/${row.original.id}`,
        },
        () => h(LButton, { size: "sm" }, () => "Open"),
      ),
  },
];
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-end">
      <LButton size="sm" @click="createOpen = true">
        <Plus class="mr-1 h-3 w-3" />
        New report
      </LButton>
    </div>

    <LCard class="p-0">
      <div v-if="isLoading" class="space-y-3 p-4">
        <LSkeleton :repeat="6" text />
      </div>
      <LDataTable
        v-else
        :data="reports?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="reports?.total ?? 0"
      />
      <div v-if="!isLoading && (reports?.items.length ?? 0) === 0" class="px-4 pb-4">
        <LEmpty
          title="No reports yet"
          description="Reports are shareable documents that combine runs, charts, and markdown."
        />
      </div>
    </LCard>

    <LDialog
      v-model:show="createOpen"
      title="New report"
      width="480px"
      @close="createError = null"
    >
      <div class="space-y-3">
        <div>
          <label
            for="report-title"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Title <span class="text-accent-danger">*</span>
          </label>
          <LInput
            id="report-title"
            v-model:value="newTitle"
            placeholder="e.g. Weekly experiment summary"
            autofocus
            @keydown.enter="submitCreate"
          />
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
            :disabled="!newTitle.trim()"
            @click="submitCreate"
          >
            Create
          </LButton>
        </div>
      </template>
    </LDialog>
  </div>
</template>