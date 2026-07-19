<script setup lang="ts">
import { computed } from "vue";
import LTree from "../primitives/LTree.vue";
import type { TreeOption } from "naive-ui";

export interface ArtifactNode {
  key: string;
  label: string;
  children?: ArtifactNode[];
  size?: number;
  isFile?: boolean;
}

export interface LArtifactTreeProps {
  data?: ArtifactNode[];
  selectedKeys?: string[];
  expandedKeys?: string[];
}

const props = withDefaults(defineProps<LArtifactTreeProps>(), {
  data: () => [],
});

const emit = defineEmits<{
  "update:selectedKeys": [keys: string[]];
  "update:expandedKeys": [keys: string[]];
  select: [key: string, node: ArtifactNode];
}>();

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function toTreeOptions(nodes: ArtifactNode[]): TreeOption[] {
  return nodes.map((node): TreeOption => {
    const size = node.size !== undefined ? ` (${formatSize(node.size)})` : "";
    return {
      key: node.key,
      label: `${node.label}${size}`,
      children: node.children ? toTreeOptions(node.children) : undefined,
      isLeaf: node.isFile ?? !node.children?.length,
    };
  });
}

const options = computed(() => toTreeOptions(props.data));

function findNode(nodes: ArtifactNode[], key: string): ArtifactNode | undefined {
  for (const node of nodes) {
    if (node.key === key) return node;
    if (node.children) {
      const found = findNode(node.children, key);
      if (found) return found;
    }
  }
  return undefined;
}

function handleUpdateSelected(keys: string[]) {
  emit("update:selectedKeys", keys);
  const key = keys[0];
  if (key) {
    const node = findNode(props.data, key);
    if (node) emit("select", key, node);
  }
}
</script>

<template>
  <LTree
    :data="options"
    :selected-keys="props.selectedKeys"
    :expanded-keys="props.expandedKeys"
    selectable
    block-line
    @update:selected-keys="handleUpdateSelected"
    @update:expanded-keys="$emit('update:expandedKeys', $event)"
  />
</template>
