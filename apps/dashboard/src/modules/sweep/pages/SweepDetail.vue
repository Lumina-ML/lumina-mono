<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { LCard, LSkeleton, LTag, LButton } from "@lumina/ui";
import { ArrowLeft } from "lucide-vue-next";
import { useSweep } from "@/modules/sweep/composables/useSweeps";
import { useDateFormat } from "@/composables/useDateFormat";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const sweepId = computed(() => route.params.sweepId as string);

const { data: sweep, isLoading } = useSweep(sweepId);
const { formatDate } = useDateFormat();
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="`/projects/${projectId}/sweeps`"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to sweeps
    </RouterLink>

    <LSkeleton v-if="isLoading" text :repeat="3" />

    <template v-else-if="sweep">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">{{ sweep.name }}</h1>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-fg-tertiary">
            <LTag size="small" type="default">{{ sweep.state }}</LTag>
            <LTag size="small" type="info">{{ sweep.method }}</LTag>
            <span>Created {{ formatDate(sweep.createdAt) }}</span>
          </div>
        </div>
        <div class="flex gap-2">
          <LButton>Pause</LButton>
          <LButton>Resume</LButton>
        </div>
      </div>

      <LCard title="Sweep Detail" class="p-6">
        <p class="text-sm text-fg-tertiary">
          Parallel coordinates, parameter importance, and run table will appear here.
        </p>
      </LCard>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Sweep not found.
    </LCard>
  </div>
</template>