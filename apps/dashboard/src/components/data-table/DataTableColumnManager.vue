<script setup lang="ts">
import { computed, ref } from "vue";
import { Settings2, Eye, EyeOff, RotateCcw } from "lucide-vue-next";
import { LDialog, LButton, LCheckbox, LIconButton } from "@lumina/ui";

export interface ColumnToggle {
  /** Stable id used as the key in v-model:visible. */
  key: string;
  /** Display label. */
  label: string;
  /** Optional group label (e.g. "Metrics"). */
  group?: string;
}

const props = defineProps<{
  columns: ColumnToggle[];
  visible: string[];
}>();

const emit = defineEmits<{
  "update:visible": [keys: string[]];
  reset: [];
}>();

const open = ref(false);

const visibleSet = computed(() => new Set(props.visible));

function isVisible(key: string): boolean {
  return visibleSet.value.has(key);
}

function toggle(key: string) {
  const next = new Set(props.visible);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  emit("update:visible", [...next]);
}

function reset() {
  emit("reset");
  emit("update:visible", props.columns.map((c) => c.key));
}

const groupedColumns = computed(() => {
  const out: Record<string, ColumnToggle[]> = {};
  for (const col of props.columns) {
    const k = col.group ?? "_default";
    if (!out[k]) out[k] = [];
    out[k]!.push(col);
  }
  return out;
});
</script>

<template>
  <LButton size="sm" @click="open = true">
    <Settings2 class="mr-1 h-3 w-3" />
    Columns
    <span class="ml-1 rounded-full bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-fg-tertiary">
      {{ visible.length }}/{{ columns.length }}
    </span>
  </LButton>

  <LDialog v-model:show="open" title="Manage columns" width="420px">
    <div class="space-y-3">
      <div
        v-for="(group, groupName) in groupedColumns"
        :key="groupName"
      >
        <div
          v-if="groupName !== '_default'"
          class="mb-1 text-[10px] font-medium uppercase tracking-wider text-fg-tertiary"
        >
          {{ groupName }}
        </div>
        <ul class="space-y-1">
          <li
            v-for="col in group"
            :key="col.key"
            class="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-canvas"
          >
            <LCheckbox
              :checked="isVisible(col.key)"
              @update:checked="() => toggle(col.key)"
            />
            <span class="flex-1 text-sm">{{ col.label }}</span>
            <LIconButton
              :aria-label="isVisible(col.key) ? 'Hide column' : 'Show column'"
              @click="toggle(col.key)"
            >
              <Eye v-if="isVisible(col.key)" class="h-3 w-3" />
              <EyeOff v-else class="h-3 w-3" />
            </LIconButton>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <LButton size="sm" quaternary @click="reset">
          <RotateCcw class="mr-1 h-3 w-3" />
          Reset to default
        </LButton>
        <LButton size="sm" @click="open = false">Done</LButton>
      </div>
    </template>
  </LDialog>
</template>