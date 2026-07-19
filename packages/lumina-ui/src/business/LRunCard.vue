<script setup lang="ts">
import LCard from "../primitives/LCard.vue";
import LTag from "../primitives/LTag.vue";
import LRunStatus from "./LRunStatus.vue";
import LTimestamp from "./LTimestamp.vue";
import LDuration from "./LDuration.vue";

export interface LRunCardProps {
  name: string;
  status: string;
  project?: string;
  createdAt?: Date | string | number;
  durationMs?: number;
  tags?: Array<{ name: string; color?: string }>;
  description?: string;
}

const props = defineProps<LRunCardProps>();
</script>

<template>
  <LCard class="l-run-card">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1 space-y-1">
        <div class="flex items-center gap-2">
          <h3 class="truncate text-sm font-semibold">{{ props.name }}</h3>
          <LRunStatus :status="props.status" />
        </div>
        <p v-if="props.description" class="line-clamp-2 text-xs text-muted-foreground">
          {{ props.description }}
        </p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span v-if="props.project">{{ props.project }}</span>
          <LTimestamp v-if="props.createdAt" :value="props.createdAt" preset="short" />
          <LDuration v-if="props.durationMs !== undefined" :duration-ms="props.durationMs" />
        </div>
      </div>
    </div>

    <div v-if="props.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
      <LTag v-for="tag in props.tags" :key="tag.name" size="small">
        {{ tag.name }}
      </LTag>
    </div>
  </LCard>
</template>

<style scoped>
.l-run-card {
  --n-padding-top: 14px;
  --n-padding-bottom: 14px;
  --n-padding-left: 16px;
  --n-padding-right: 16px;
}
</style>
