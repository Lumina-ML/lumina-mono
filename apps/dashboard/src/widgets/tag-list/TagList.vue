<script setup lang="ts">
import { ref } from "vue";
import { LTag, LEmpty, LInput, LButton, LIconButton } from "@lumina/ui";
import { X } from "lucide-vue-next";
import type { Tag } from "@/types/tag";

defineProps<{
  tags: Tag[];
  loading?: boolean;
  editable?: boolean;
}>();

const emit = defineEmits<{
  attach: [name: string];
  detach: [tagId: string];
}>();

const newTag = ref("");

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

function submit() {
  const name = newTag.value.trim();
  if (!name) return;
  emit("attach", name);
  newTag.value = "";
}
</script>

<template>
  <div>
    <div v-if="loading" class="py-8 text-center text-muted-foreground">Loading tags...</div>
    <div v-else-if="tags.length === 0 && !editable" class="py-8">
      <LEmpty description="No tags attached to this run" />
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <LTag
        v-for="(tag, index) in tags"
        :key="tag.id"
        round
        :color="{ textColor: getTagColor(tag, index), borderColor: getTagColor(tag, index) }"
        class="inline-flex items-center gap-1"
      >
        {{ tag.name }}
        <LIconButton
          v-if="editable"
          aria-label="Remove tag"
          size="small"
          class="-mr-1 h-4 w-4"
          @click="emit('detach', tag.id)"
        >
          <X class="h-3 w-3" />
        </LIconButton>
      </LTag>
      <form
        v-if="editable"
        class="flex items-center gap-1"
        @submit.prevent="submit"
      >
        <LInput
          v-model:value="newTag"
          size="small"
          placeholder="Add tag…"
          class="w-28"
          @keydown.enter.prevent="submit"
        />
        <LButton size="xs" :disabled="!newTag.trim()" @click="submit">
          Add
        </LButton>
      </form>
    </div>
  </div>
</template>
