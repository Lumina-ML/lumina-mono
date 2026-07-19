<script setup lang="ts">
import { computed } from "vue";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";

export interface LJsonViewProps {
  /** JSON data value or JSON string. */
  data?: unknown;
  /** Default expand depth. */
  deep?: number;
  /** Enable virtual scrolling for large JSON trees. */
  virtual?: boolean;
  /** Viewport height when virtual is enabled. */
  height?: number;
  /** Row height when virtual is enabled. */
  itemHeight?: number;
  /** Collapse/expand nodes by clicking brackets. */
  collapsedOnClickBrackets?: boolean;
  /** Show connecting lines. */
  showLine?: boolean;
  /** Show line numbers. */
  showLineNumber?: boolean;
  /** Show collection length badges. */
  showLength?: boolean;
  /** Show type icons. */
  showIcon?: boolean;
  /** Selection mode. */
  selectableType?: "" | "single" | "multiple";
  /** Controlled selected path(s). */
  selectedValue?: string | string[];
}

const props = withDefaults(defineProps<LJsonViewProps>(), {
  deep: Infinity,
  virtual: false,
  height: 400,
  itemHeight: 24,
  collapsedOnClickBrackets: true,
  showLine: true,
  showLineNumber: false,
  showLength: true,
  showIcon: true,
  selectableType: "",
  selectedValue: "",
});

const emit = defineEmits<{
  nodeClick: [node: unknown];
  selectedChange: [value: string | string[]];
  "update:selectedValue": [value: string | string[]];
}>();

const jsonData = computed<unknown>(() => {
  if (props.data === undefined) return null;
  if (typeof props.data === "string") {
    try {
      return JSON.parse(props.data);
    } catch {
      return props.data;
    }
  }
  return props.data;
});
</script>

<template>
  <div class="l-json-view rounded-md border border-border bg-card p-3 text-foreground">
    <VueJsonPretty
      :data="jsonData as any"
      :deep="deep"
      :virtual="virtual"
      :height="height"
      :item-height="itemHeight"
      :collapsed-on-click-brackets="collapsedOnClickBrackets"
      :show-line="showLine"
      :show-line-number="showLineNumber"
      :show-length="showLength"
      :show-icon="showIcon"
      :selectable-type="selectableType"
      :selected-value="selectedValue"
      @node-click="emit('nodeClick', $event)"
      @selected-change="emit('selectedChange', $event)"
      @update:selected-value="emit('update:selectedValue', $event)"
    />
  </div>
</template>
