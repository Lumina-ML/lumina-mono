<script setup lang="ts">
import { computed } from "vue";
import LTooltip from "../primitives/LTooltip.vue";
import { useClipboard } from "../composables/useClipboard";

export interface LCopyableProps {
  value: string;
  /** 显示文本，默认 value */
  label?: string;
  /** 是否显示图标 */
  showIcon?: boolean;
}

const props = withDefaults(defineProps<LCopyableProps>(), {
  showIcon: true,
});

const display = computed(() => props.label ?? props.value);
const { copied, copy } = useClipboard();
</script>

<template>
  <LTooltip :content="copied ? 'Copied' : 'Copy'">
    <button
      type="button"
      class="inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm transition-colors hover:bg-muted"
      @click="copy(value)"
    >
      <span class="truncate">{{ display }}</span>
      <span v-if="showIcon" class="text-muted-foreground">
        <svg
          v-if="copied"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-3.5 w-3.5"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-3.5 w-3.5"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      </span>
    </button>
  </LTooltip>
</template>
