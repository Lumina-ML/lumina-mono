<script setup lang="ts">
import { computed, type Component } from "vue";
import { X, GitCompare } from "lucide-vue-next";
import { LButton, LTag } from "@lumina/ui";
import { useConfirm } from "@/composables/useConfirm";

const { confirm } = useConfirm();

interface BulkAction {
  key: string;
  label: string;
  icon?: Component;
  danger?: boolean;
}

const props = defineProps<{
  selectedCount: number;
  totalCount: number;
  actions?: BulkAction[];
  /** Disable destructive actions when selected count exceeds threshold. */
  confirmThreshold?: number;
}>();

const emit = defineEmits<{
  action: [key: string];
  clear: [];
}>();

const tooMany = computed(() => {
  const threshold = props.confirmThreshold ?? 10;
  return props.selectedCount > threshold;
});

async function onAction(action: BulkAction) {
  if (action.danger && tooMany.value) {
    const ok = await confirm({
      title: `${action.label} ${props.selectedCount} items?`,
      message: "This cannot be undone.",
      confirmText: action.label,
      tone: "danger",
    });
    if (!ok) return;
  }
  emit("action", action.key);
}
</script>

<template>
  <Transition name="bulk-slide">
    <div
      v-if="selectedCount > 0"
      class="flex items-center justify-between gap-2 rounded-md border border-accent-primary/30 bg-accent-primary/5 px-3 py-2"
    >
      <div class="flex items-center gap-3 text-sm">
        <LTag size="small" type="primary">{{ selectedCount }} selected</LTag>
        <span class="text-xs text-fg-tertiary">
          of {{ totalCount }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <LButton size="sm" @click="emit('action', 'compare')">
          <GitCompare class="mr-1 h-3 w-3" />
          Compare
        </LButton>
        <LButton
          v-for="action in actions"
          :key="action.key"
          size="sm"
          :type="action.danger ? 'error' : 'default'"
          @click="onAction(action)"
        >
          <component
            :is="action.icon"
            v-if="action.icon"
            class="mr-1 h-3 w-3"
          />
          {{ action.label }}
        </LButton>
        <LButton
          quaternary
          size="xs"
          class="!ml-1 !text-fg-tertiary hover:!text-fg-primary"
          @click="emit('clear')"
        >
          <X class="mr-1 h-3 w-3" />
          Clear
        </LButton>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.bulk-slide-enter-active,
.bulk-slide-leave-active {
  transition: all 180ms ease;
}
.bulk-slide-enter-from,
.bulk-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>