<script setup lang="ts">
import { NTag, NEmpty } from "naive-ui";
import type { Tag } from "@/types/tag";

const props = defineProps<{
  tags: Tag[];
  loading?: boolean;
}>();

const tagColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

function getTagColor(tag: Tag, index: number): string {
  return tag.color ?? tagColors[index % tagColors.length];
}
</script>

<template>
  <div>
    <div v-if="loading" class="py-8 text-center text-muted-foreground">Loading tags...</div>
    <div v-else-if="tags.length === 0" class="py-8">
      <NEmpty description="No tags attached to this run" />
    </div>
    <div v-else class="flex flex-wrap gap-2">
      <NTag
        v-for="(tag, index) in tags"
        :key="tag.id"
        round
        :color="{ textColor: getTagColor(tag, index), borderColor: getTagColor(tag, index) }"
      >
        {{ tag.name }}
      </NTag>
    </div>
  </div>
</template>
