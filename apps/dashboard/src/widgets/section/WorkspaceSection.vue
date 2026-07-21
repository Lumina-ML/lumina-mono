<script setup lang="ts">
import { ChevronDown, ChevronRight, Plus, Trash2, Edit3, EyeOff } from "lucide-vue-next";
import {
  LIconButton,
  LTooltip,
  LButton,
  LDialog,
  LInput,
} from "@lumina/ui";
import { ref } from "vue";
import ChartPanel, { type ChartPanelConfig } from "@/widgets/chart-panel/ChartPanel.vue";
import { useConfirm } from "@/composables/useConfirm";

const { confirm } = useConfirm();

export interface WorkspacePanel {
  id: string;
  config: ChartPanelConfig;
}

export interface WorkspaceSectionData {
  id: string;
  name: string;
  collapsed: boolean;
  hidden: boolean;
  panels: WorkspacePanel[];
}

const props = defineProps<{
  section: WorkspaceSectionData;
  runIds: string[];
  editable?: boolean;
}>();

const emit = defineEmits<{
  "update:section": [next: WorkspaceSectionData];
  remove: [];
  "add-panel": [];
}>();

function patch(partial: Partial<WorkspaceSectionData>) {
  emit("update:section", { ...props.section, ...partial });
}

function toggleCollapsed() {
  patch({ collapsed: !props.section.collapsed });
}

// Rename section dialog (replaces window.prompt).
const renameOpen = ref(false);
const renameDraft = ref("");
const renameError = ref<string | null>(null);

function openRename() {
  renameDraft.value = props.section.name;
  renameError.value = null;
  renameOpen.value = true;
}

function submitRename() {
  const name = renameDraft.value.trim();
  if (!name) {
    renameError.value = "Section name is required";
    return;
  }
  patch({ name });
  renameOpen.value = false;
}

function hide() {
  patch({ hidden: true });
}

async function deleteSection() {
  const ok = await confirm({
    title: "Delete section?",
    message: `Delete section "${props.section.name}"? Its panels will be removed.`,
    confirmText: "Delete",
    tone: "danger",
  });
  if (ok) emit("remove");
}

function removePanel(panelId: string) {
  patch({
    panels: props.section.panels.filter((p) => p.id !== panelId),
  });
}

function patchPanel(panelId: string, config: ChartPanelConfig) {
  patch({
    panels: props.section.panels.map((p) =>
      p.id === panelId ? { ...p, config } : p,
    ),
  });
}
</script>

<template>
  <section v-if="!section.hidden" class="space-y-3">
    <header
      class="group flex items-center justify-between gap-2 rounded-md border border-transparent px-1 py-1 hover:border-border"
    >
      <LButton
        quaternary
        size="sm"
        class="!flex !min-w-0 !flex-1 !items-center !gap-2 !text-left !p-0"
        @click="toggleCollapsed"
      >
        <component
          :is="section.collapsed ? ChevronRight : ChevronDown"
          class="h-4 w-4 flex-shrink-0 text-fg-tertiary"
          aria-hidden="true"
        />
        <span class="truncate text-sm font-semibold">{{ section.name }}</span>
        <span class="rounded-full bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-fg-tertiary">
          {{ section.panels.length }}
        </span>
      </LButton>

      <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <LButton size="sm" @click="emit('add-panel')">
          <Plus class="mr-1 h-3 w-3" />
          Add Panel
        </LButton>
        <template v-if="editable !== false">
          <LTooltip content="Rename section">
            <LIconButton aria-label="Rename" @click="openRename">
              <Edit3 class="h-3.5 w-3.5" />
            </LIconButton>
          </LTooltip>
          <LTooltip content="Hide section">
            <LIconButton aria-label="Hide" @click="hide">
              <EyeOff class="h-3.5 w-3.5" />
            </LIconButton>
          </LTooltip>
          <LTooltip content="Delete section">
            <LIconButton aria-label="Delete" @click="deleteSection">
              <Trash2 class="h-3.5 w-3.5" />
            </LIconButton>
          </LTooltip>
        </template>
      </div>
    </header>

    <div v-if="!section.collapsed">
      <div
        v-if="section.panels.length === 0"
        class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-canvas/50 px-4 py-8 text-center text-xs text-fg-tertiary"
      >
        <p>No panels yet. Add one to start visualizing metrics.</p>
        <LButton size="sm" @click="emit('add-panel')">
          <Plus class="mr-1 h-3 w-3" />
          Add Panel
        </LButton>
      </div>

      <div
        v-else
        class="grid grid-cols-1 gap-3 xl:grid-cols-2"
      >
        <div
          v-for="panel in section.panels"
          :key="panel.id"
          class="min-h-[260px]"
        >
          <ChartPanel
            :config="panel.config"
            :run-ids="runIds"
            @remove="removePanel(panel.id)"
            @update:config="(next) => patchPanel(panel.id, next)"
          />
        </div>
      </div>
    </div>
  </section>

  <LDialog
    v-model:show="renameOpen"
    title="Rename section"
    width="480px"
    @close="renameError = null"
  >
    <form class="space-y-3" @submit.prevent="submitRename">
      <div>
        <label for="section-rename" class="mb-1 block text-xs font-medium text-fg-secondary">
          Section name <span class="text-accent-danger">*</span>
        </label>
        <LInput
          id="section-rename"
          v-model:value="renameDraft"
          autofocus
        />
      </div>
      <div
        v-if="renameError"
        class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
      >
        {{ renameError }}
      </div>
    </form>
    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton quaternary @click="renameOpen = false">Cancel</LButton>
        <LButton :disabled="!renameDraft.trim()" @click="submitRename">
          Save
        </LButton>
      </div>
    </template>
  </LDialog>
</template>