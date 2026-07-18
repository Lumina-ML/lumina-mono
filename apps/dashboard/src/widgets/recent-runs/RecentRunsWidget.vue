<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { LCard, LButton, LSkeleton } from "@lumina/ui";
import { useRuns } from "@/modules/run/composables/useRuns";

const { data: runs, isLoading } = useRuns(ref({ limit: 5 }));
const recentRuns = computed(() => runs.value?.items ?? []);
</script>

<template>
  <LCard title="Recent Runs">
    <div v-if="isLoading" class="space-y-2">
      <LSkeleton v-for="i in 3" :key="i" text />
    </div>
    <div v-else-if="recentRuns.length === 0" class="py-4 text-muted-foreground">
      No runs yet. Run an experiment to see data here.
    </div>
    <div v-else class="space-y-2">
      <RouterLink
        v-for="run in recentRuns"
        :key="run.runId"
        :to="`/runs/${run.runId}`"
        class="flex items-center justify-between rounded-md p-3 transition-colors hover:bg-muted"
      >
        <div>
          <div class="font-medium">{{ run.name }}</div>
          <div class="text-xs text-muted-foreground">{{ run.status }}</div>
        </div>
        <LButton size="sm">View</LButton>
      </RouterLink>
    </div>
  </LCard>
</template>
