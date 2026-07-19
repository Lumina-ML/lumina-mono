<script setup lang="ts">
import { computed } from "vue";

export interface LConfigViewerProps {
  value?: Record<string, unknown> | unknown[] | string;
  /** 是否折叠，默认展开 */
  collapsed?: boolean;
  /** 最大显示行数 */
  maxLines?: number;
}

const props = defineProps<LConfigViewerProps>();

const json = computed(() => {
  if (props.value === undefined) return "";
  try {
    return JSON.stringify(props.value, null, 2);
  } catch {
    return String(props.value);
  }
});

const lines = computed(() => json.value.split("\n"));

const displayLines = computed(() => {
  if (props.maxLines && lines.value.length > props.maxLines) {
    return lines.value.slice(0, props.maxLines);
  }
  return lines.value;
});

const hasMore = computed(() => Boolean(props.maxLines && lines.value.length > props.maxLines));

function highlight(line: string): string {
  // 简单语法高亮：将 key、string、number、boolean/null 用 span 包裹
  return line
    .replace(/^(\s*)("[^"]+")(?=:)/, '$1<span class="text-primary">$2</span>')
    .replace(/: ("(?:[^"\\]|\\.)*")/, ': <span class="text-success">$1</span>')
    .replace(/: (-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/, ': <span class="text-info">$1</span>')
    .replace(/: (true|false)/, ': <span class="text-warning">$1</span>')
    .replace(/: (null)/, ': <span class="text-muted-foreground">$1</span>');
}
</script>

<template>
  <pre
    :class="[
      'overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed',
      collapsed ? 'max-h-32' : 'max-h-[60vh]',
    ]"
  ><code class="font-mono"><span
    v-for="(line, index) in displayLines"
    :key="index"
    class="block"
    v-html="highlight(line)"
  /><span v-if="hasMore" class="block text-muted-foreground">... {{ lines.length - displayLines.length }} more lines</span></code></pre>
</template>
