<script setup lang="ts">
import { computed, ref } from "vue";
import { Eye, EyeOff, Search, Pin, PinOff, X } from "lucide-vue-next";
import { LInput, LIconButton, LTooltip, LTag, LButton } from "@lumina/ui";
import RunStatusBadge from "@/widgets/run-status-badge/RunStatusBadge.vue";
import { colorForRunId } from "@/composables/useRunColor";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Run, RunStatus } from "@/types/run";

interface Props {
  runs: Run[];
  selectedRunIds: string[];
  hiddenRunIds: string[];
  pinnedRunIds: string[];
  statusFilter?: RunStatus | null;
}

const props = withDefaults(defineProps<Props>(), {
  statusFilter: null,
});

const emit = defineEmits<{
  "update:selectedRunIds": [ids: string[]];
  "update:hiddenRunIds": [ids: string[]];
  "update:pinnedRunIds": [ids: string[]];
  "update:statusFilter": [status: RunStatus | null];
}>();

const { formatDate } = useDateFormat();

const search = ref("");

const filteredRuns = computed(() => {
  const q = search.value.trim().toLowerCase();
  const status = props.statusFilter;
  return props.runs.filter((r) => {
    if (status && r.status !== status) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.runId.toLowerCase().includes(q)
    );
  });
});

const pinnedRuns = computed(() =>
  filteredRuns.value.filter((r) => props.pinnedRunIds.includes(r.runId)),
);
const unpinnedRuns = computed(() =>
  filteredRuns.value.filter((r) => !props.pinnedRunIds.includes(r.runId)),
);

const selectedSet = computed(() => new Set(props.selectedRunIds));
const hiddenSet = computed(() => new Set(props.hiddenRunIds));

function toggleSelected(runId: string) {
  const next = new Set(selectedSet.value);
  if (next.has(runId)) next.delete(runId);
  else next.add(runId);
  emit("update:selectedRunIds", [...next]);
}

function toggleHidden(runId: string) {
  const next = new Set(hiddenSet.value);
  if (next.has(runId)) next.delete(runId);
  else next.add(runId);
  emit("update:hiddenRunIds", [...next]);
}

function togglePinned(runId: string) {
  const next = new Set(props.pinnedRunIds);
  if (next.has(runId)) next.delete(runId);
  else next.add(runId);
  emit("update:pinnedRunIds", [...next]);
}

function clearSelection() {
  emit("update:selectedRunIds", []);
}

const statusOptions: RunStatus[] = [
  "running",
  "finished",
  "failed",
  "crashed",
  "pending",
];

function setStatus(s: RunStatus | null) {
  emit("update:statusFilter", s);
}

const totalLabel = computed(() => {
  const total = props.runs.length;
  const shown = filteredRuns.value.length;
  if (total === shown) return `${total} runs`;
  return `${shown} of ${total} runs`;
});
</script>

<template>
  <aside class="flex h-full w-full min-w-0 flex-col border-r border-border bg-card">
    <!-- Header -->
    <div class="border-b border-border p-3">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
          Runs
        </span>
        <span class="font-mono text-xs text-fg-tertiary">{{ totalLabel }}</span>
      </div>

      <LInput
        v-model:value="search"
        size="small"
        placeholder="Filter runs…"
      >
        <template #prefix>
          <Search class="h-3.5 w-3.5 text-fg-tertiary" />
        </template>
      </LInput>

      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <LTag
          size="small"
          :type="statusFilter == null ? 'primary' : 'default'"
          class="cursor-pointer"
          @click="setStatus(null)"
        >
          All
        </LTag>
        <LTag
          v-for="s in statusOptions"
          :key="s"
          size="small"
          :type="statusFilter === s ? 'primary' : 'default'"
          class="cursor-pointer"
          @click="setStatus(s)"
        >
          {{ s }}
        </LTag>
      </div>

      <div
        v-if="selectedRunIds.length > 0"
        class="mt-2 flex items-center justify-between text-xs text-fg-tertiary"
      >
        <span>{{ selectedRunIds.length }} selected</span>
        <LButton
          quaternary
          size="xs"
          class="!flex !items-center !gap-0.5 hover:!text-fg-primary"
          @click="clearSelection"
        >
          <X class="h-3 w-3" />
          Clear
        </LButton>
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="filteredRuns.length === 0" class="p-6 text-center text-xs text-fg-tertiary">
        No runs match these filters.
      </div>

      <template v-else>
        <div v-if="pinnedRuns.length > 0" class="px-2 pb-1 pt-2">
          <div class="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
            Pinned
          </div>
          <ul class="space-y-0.5">
            <li
              v-for="run in pinnedRuns"
              :key="`pin-${run.runId}`"
              class="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-canvas"
            >
              <span
                class="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                :style="{ backgroundColor: colorForRunId(run.runId) }"
                aria-hidden="true"
              />
              <LButton
                quaternary
                size="xs"
                :class="[
                  '!flex !h-5 !w-5 !flex-shrink-0 !items-center !justify-center !rounded !border !p-0',
                  selectedSet.has(run.runId)
                    ? '!border-accent-primary !bg-accent-primary/15 !text-accent-primary'
                    : '!border-border !bg-card hover:!border-fg-tertiary',
                ]"
                :aria-label="selectedSet.has(run.runId) ? 'Hide from charts' : 'Show in charts'"
                @click="toggleSelected(run.runId)"
              >
                <span v-if="selectedSet.has(run.runId)" aria-hidden="true" class="text-[10px]">✓</span>
              </LButton>
              <div class="flex min-w-0 flex-1 flex-col">
                <span
                  :class="[
                    'truncate text-sm',
                    hiddenSet.has(run.runId) ? 'text-fg-muted line-through' : 'text-fg-primary',
                  ]"
                >
                  {{ run.name }}
                </span>
                <div class="flex items-center gap-1.5 text-[10px] text-fg-tertiary">
                  <RunStatusBadge :status="run.status" />
                  <span class="font-mono">{{ formatDate(run.createdAt) }}</span>
                </div>
              </div>
              <LTooltip content="Hide / show run" placement="left">
                <LIconButton
                  aria-label="Toggle visibility"
                  class="hidden group-hover:inline-flex"
                  @click="toggleHidden(run.runId)"
                >
                  <EyeOff v-if="hiddenSet.has(run.runId)" class="h-3 w-3" />
                  <Eye v-else class="h-3 w-3" />
                </LIconButton>
              </LTooltip>
              <LTooltip content="Unpin" placement="left">
                <LIconButton
                  aria-label="Unpin"
                  class="hidden group-hover:inline-flex"
                  @click="togglePinned(run.runId)"
                >
                  <PinOff class="h-3 w-3" />
                </LIconButton>
              </LTooltip>
            </li>
          </ul>
        </div>

        <div v-if="unpinnedRuns.length > 0" class="px-2 pb-2 pt-1">
          <div
            v-if="pinnedRuns.length > 0"
            class="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-fg-tertiary"
          >
            All Runs
          </div>
          <ul class="space-y-0.5">
            <li
              v-for="run in unpinnedRuns"
              :key="run.runId"
              class="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-canvas"
            >
              <span
                class="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                :style="{ backgroundColor: colorForRunId(run.runId) }"
                aria-hidden="true"
              />
              <LButton
                quaternary
                size="xs"
                :class="[
                  '!flex !h-5 !w-5 !flex-shrink-0 !items-center !justify-center !rounded !border !p-0',
                  selectedSet.has(run.runId)
                    ? '!border-accent-primary !bg-accent-primary/15 !text-accent-primary'
                    : '!border-border !bg-card hover:!border-fg-tertiary',
                ]"
                :aria-label="selectedSet.has(run.runId) ? 'Hide from charts' : 'Show in charts'"
                @click="toggleSelected(run.runId)"
              >
                <span v-if="selectedSet.has(run.runId)" aria-hidden="true" class="text-[10px]">✓</span>
              </LButton>
              <div class="flex min-w-0 flex-1 flex-col">
                <span
                  :class="[
                    'truncate text-sm',
                    hiddenSet.has(run.runId) ? 'text-fg-muted line-through' : 'text-fg-primary',
                  ]"
                >
                  {{ run.name }}
                </span>
                <div class="flex items-center gap-1.5 text-[10px] text-fg-tertiary">
                  <RunStatusBadge :status="run.status" />
                  <span class="font-mono">{{ formatDate(run.createdAt) }}</span>
                </div>
              </div>
              <LTooltip content="Hide / show run" placement="left">
                <LIconButton
                  aria-label="Toggle visibility"
                  class="hidden group-hover:inline-flex"
                  @click="toggleHidden(run.runId)"
                >
                  <EyeOff v-if="hiddenSet.has(run.runId)" class="h-3 w-3" />
                  <Eye v-else class="h-3 w-3" />
                </LIconButton>
              </LTooltip>
              <LTooltip content="Pin to top" placement="left">
                <LIconButton
                  aria-label="Pin"
                  class="hidden group-hover:inline-flex"
                  @click="togglePinned(run.runId)"
                >
                  <Pin class="h-3 w-3" />
                </LIconButton>
              </LTooltip>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </aside>
</template>