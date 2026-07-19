<script setup lang="ts">
import { ref, computed } from "vue";
import LInput from "../primitives/LInput.vue";
import LTag from "../primitives/LTag.vue";

export interface LTagInputProps {
  tags?: string[];
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  /** 是否允许重复 */
  allowDuplicate?: boolean;
}

const props = withDefaults(defineProps<LTagInputProps>(), {
  tags: () => [],
  placeholder: "Add tag...",
  allowDuplicate: false,
});

const emit = defineEmits<{
  "update:tags": [tags: string[]];
}>();

const inputValue = ref("");

const canAdd = computed(() => {
  const value = inputValue.value.trim();
  if (!value) return false;
  if (props.maxLength && value.length > props.maxLength) return false;
  if (!props.allowDuplicate && props.tags.includes(value)) return false;
  return true;
});

function addTag() {
  if (!canAdd.value) return;
  const value = inputValue.value.trim();
  emit("update:tags", [...props.tags, value]);
  inputValue.value = "";
}

function removeTag(index: number) {
  const next = [...props.tags];
  next.splice(index, 1);
  emit("update:tags", next);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    addTag();
  }
  if (event.key === "Backspace" && !inputValue.value && props.tags.length > 0) {
    removeTag(props.tags.length - 1);
  }
}
</script>

<template>
  <div
    :class="[
      'flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5',
      props.disabled ? 'cursor-not-allowed opacity-60' : '',
    ]"
  >
    <LTag
      v-for="(tag, index) in props.tags"
      :key="`${tag}-${index}`"
      size="small"
      closable
      :disabled="props.disabled"
      @close="removeTag(index)"
    >
      {{ tag }}
    </LTag>
    <LInput
      v-model:value="inputValue"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      size="small"
      class="flex-1 min-w-[80px]"
      @keydown="handleKeydown"
      @blur="addTag"
    />
  </div>
</template>
