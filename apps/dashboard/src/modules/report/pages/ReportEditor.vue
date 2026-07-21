<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  LCard,
  LButton,
  LSkeleton,
  LEmpty,
  LTag,
  LDialog,
} from "@lumina/ui";
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Download,
} from "lucide-vue-next";
import { useReport } from "@/modules/report/composables/useReports";
import { ReportService } from "@/services/report.service";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";
import {
  coerceBlocks,
  makeBlock,
  blocksToMarkdown,
  type Block,
  type BlockType,
} from "@/widgets/report/blocks";
import BlockEditor from "@/widgets/report/BlockEditor.vue";
import BlockRenderer from "@/widgets/report/BlockRenderer.vue";

const route = useRoute();
const queryClient = useQueryClient();
const toast = useToast();
const { formatDate } = useDateFormat();

const projectId = computed(() => route.params.projectId as string);
const reportId = computed(() => route.params.reportId as string);

const { data: report, isLoading } = useReport(reportId);

const editing = ref(false);
const draftTitle = ref("");
const draftBlocks = ref<Block[]>([]);

watch(
  report,
  (r) => {
    if (!r) return;
    draftTitle.value = r.title;
    draftBlocks.value = coerceBlocks(r.blocks);
  },
  { immediate: true },
);

function startEdit() {
  if (!report.value) return;
  draftTitle.value = report.value.title;
  draftBlocks.value = coerceBlocks(report.value.blocks);
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  if (report.value) {
    draftTitle.value = report.value.title;
    draftBlocks.value = coerceBlocks(report.value.blocks);
  }
}

const saveMutation = useMutation({
  mutationFn: () =>
    ReportService.update(reportId.value, {
      title: draftTitle.value,
      blocks: draftBlocks.value.map((b) => ({
        id: b.id,
        type: b.type,
        data: b.data,
      })),
    }),
  onSuccess: () => {
    toast.success("Report saved");
    queryClient.invalidateQueries({ queryKey: ["report", reportId.value] });
    editing.value = false;
  },
  onError: (e) => toast.error(`Save failed: ${(e as Error).message}`),
});

function addBlock(type: BlockType, index: number) {
  const block = makeBlock(type);
  const arr = [...draftBlocks.value];
  arr.splice(index, 0, block);
  draftBlocks.value = arr;
}

function removeBlock(index: number) {
  const arr = [...draftBlocks.value];
  arr.splice(index, 1);
  draftBlocks.value = arr;
}

function moveBlock(from: number, to: number) {
  const arr = [...draftBlocks.value];
  const [item] = arr.splice(from, 1);
  if (item) arr.splice(to, 0, item);
  draftBlocks.value = arr;
}

// ── Markdown export dialog ──────────────────────────────────────────────
const exportOpen = ref(false);
const exportContent = computed(() => blocksToMarkdown(draftBlocks.value));

function downloadMd() {
  const blob = new Blob([exportContent.value], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${draftTitle.value || "report"}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
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
          <LInput
            v-if="editing"
            v-model="draftTitle"
            size="large"
            class="!bg-transparent !text-2xl !font-semibold !tracking-tight"
            @keydown.enter="saveMutation.mutate()"
          />
          <h1 v-else class="truncate text-2xl font-semibold tracking-tight">
            {{ report.title }}
          </h1>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-tertiary">
            <span v-if="report.createdBy">By {{ report.createdBy }}</span>
            <span>·</span>
            <span>Updated {{ formatDate(report.updatedAt) }}</span>
            <LTag size="small" type="default">
              {{ draftBlocks.length }} blocks
            </LTag>
          </div>
        </div>
        <div class="flex gap-2">
          <template v-if="editing">
            <LButton quaternary @click="cancelEdit">
              <X class="mr-1 h-3 w-3" />
              Cancel
            </LButton>
            <LButton :loading="saveMutation.isPending.value" @click="saveMutation.mutate()">
              <Save class="mr-1 h-3 w-3" />
              Save
            </LButton>
          </template>
          <template v-else>
            <LButton quaternary @click="exportOpen = true">
              <Download class="mr-1 h-3 w-3" />
              Export
            </LButton>
            <LButton @click="startEdit">
              <Edit3 class="mr-1 h-3 w-3" />
              Edit
            </LButton>
          </template>
        </div>
      </div>

      <LCard class="p-6">
        <BlockEditor
          v-if="editing"
          :blocks="draftBlocks"
          @update:blocks="(v: Block[]) => (draftBlocks = v)"
          @add-block="(t, i) => addBlock(t, i)"
          @remove="(i) => removeBlock(i)"
          @move="(from, to) => moveBlock(from, to)"
        />
        <div v-else-if="draftBlocks.length > 0" class="space-y-4">
          <BlockRenderer
            v-for="block in draftBlocks"
            :key="block.id"
            :block="block"
          />
        </div>
        <LEmpty
          v-else
          class="py-12"
          title="Empty report"
          description="Click Edit to start writing. Reports support markdown, code, charts, images, and callouts."
        />
      </LCard>

      <LDialog
        v-model:show="exportOpen"
        title="Export as Markdown"
        width="640px"
      >
        <p class="mb-2 text-xs text-fg-tertiary">
          Preview of the report serialized to Markdown. Chart and image
          blocks render as placeholders in the .md output.
        </p>
        <LTextarea
          :value="exportContent"
          readonly
          :rows="16"
          class="!w-full !rounded-md !border !border-border !bg-canvas !p-3 !font-mono !text-xs"
        ></LTextarea>
        <template #footer>
          <div class="flex justify-end gap-2">
            <LButton quaternary @click="exportOpen = false">Close</LButton>
            <LButton @click="downloadMd">
              <Download class="mr-1 h-3 w-3" />
              Download .md
            </LButton>
          </div>
        </template>
      </LDialog>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Report not found.
    </LCard>
  </div>
</template>