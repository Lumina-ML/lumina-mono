<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import {
  LCard,
  LTag,
  LButton,
  LSkeleton,
  LEmpty,
  LMarkdown,
} from "@lumina/ui";
import { ArrowLeft, Edit3, Share2, Save, X } from "lucide-vue-next";
import { useReport } from "@/modules/report/composables/useReports";
import { useDateFormat } from "@/composables/useDateFormat";
import { ReportService } from "@/services/report.service";
import { useMutation, useQueryClient } from "@tanstack/vue-query";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const reportId = computed(() => route.params.reportId as string);
const { formatDate } = useDateFormat();
const queryClient = useQueryClient();

const { data: report, isLoading } = useReport(reportId);
const editing = ref(false);
const draftTitle = ref("");

function startEdit() {
  if (!report.value) return;
  draftTitle.value = report.value.title;
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
}

const saveMutation = useMutation({
  mutationFn: (title: string) => ReportService.update(reportId.value, { title }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["report", reportId.value] });
    editing.value = false;
  },
});

function save() {
  if (!draftTitle.value.trim()) return;
  saveMutation.mutate(draftTitle.value.trim());
}

// Render blocks as a flat list — we render title + each block's text content
// if present. The full Notion-like block editor is a Phase 3 item.
const blockEntries = computed(() => {
  const blocks = (report.value?.blocks ?? []) as Array<Record<string, unknown>>;
  return blocks.map((b) => ({
    type: typeof b.type === "string" ? (b.type as string) : "text",
    text:
      typeof b.text === "string"
        ? (b.text as string)
        : typeof b.content === "string"
          ? (b.content as string)
          : "",
  }));
});
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="`/projects/${projectId}/reports`"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to reports
    </RouterLink>

    <LSkeleton v-if="isLoading" text :repeat="3" />

    <template v-else-if="report">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <input
            v-if="editing"
            v-model="draftTitle"
            type="text"
            class="w-full bg-transparent text-2xl font-semibold tracking-tight focus:outline-none focus:ring-1 focus:ring-accent-primary"
            @keydown.enter="save"
            @keydown.esc="cancelEdit"
          />
          <h1 v-else class="truncate text-2xl font-semibold tracking-tight">
            {{ report.title }}
          </h1>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-fg-tertiary">
            <span v-if="report.createdBy">By {{ report.createdBy }}</span>
            <span>Updated {{ formatDate(report.updatedAt) }}</span>
            <LTag size="small" type="default">{{ blockEntries.length }} blocks</LTag>
          </div>
        </div>
        <div class="flex gap-2">
          <template v-if="editing">
            <LButton size="sm" @click="save" :loading="saveMutation.isPending.value">
              <Save class="mr-1 h-3 w-3" />
              Save
            </LButton>
            <LButton size="sm" quaternary @click="cancelEdit">
              <X class="mr-1 h-3 w-3" />
              Cancel
            </LButton>
          </template>
          <template v-else>
            <LButton size="sm" @click="startEdit">
              <Edit3 class="mr-1 h-3 w-3" />
              Edit
            </LButton>
            <LButton size="sm" quaternary>
              <Share2 class="mr-1 h-3 w-3" />
              Share
            </LButton>
          </template>
        </div>
      </div>

      <LCard class="p-6">
        <div v-if="blockEntries.length > 0" class="space-y-4">
          <LMarkdown
            v-for="(block, idx) in blockEntries"
            :key="idx"
            :source="block.text"
          />
        </div>
        <LEmpty
          v-else
          title="Empty report"
          description="Click Edit to add content. Reports are stored as a list of blocks (heading, paragraph, image, chart embed)."
        />
      </LCard>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Report not found.
    </LCard>
  </div>
</template>