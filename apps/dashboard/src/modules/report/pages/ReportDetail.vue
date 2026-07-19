<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { LCard, LButton } from "@lumina/ui";
import { ArrowLeft, Edit3, Share2 } from "lucide-vue-next";
import { useDateFormat } from "@/composables/useDateFormat";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const reportId = computed(() => route.params.reportId as string);
const { formatDate } = useDateFormat();

const report = computed(() => ({
  id: reportId.value,
  title: `Report ${reportId.value}`,
  description: "A shareable document combining runs, charts, and markdown.",
  updatedAt: new Date().toISOString(),
}));
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

    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ report.title }}</h1>
        <p class="mt-1 text-sm text-fg-tertiary">
          Updated {{ formatDate(report.updatedAt) }}
        </p>
      </div>
      <div class="flex gap-2">
        <LButton><Edit3 class="mr-1 h-4 w-4" />Edit</LButton>
        <LButton><Share2 class="mr-1 h-4 w-4" />Share</LButton>
      </div>
    </div>

    <LCard class="p-6">
      <p class="text-sm text-fg-tertiary">
        Report body (markdown + embedded charts) will render here.
      </p>
    </LCard>
  </div>
</template>