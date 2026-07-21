<script setup lang="ts">
import { computed } from "vue";
import {
  LDialog,
  LButton,
  LInput,
  LTextarea,
  LAlert,
  LSelect,
  LTag,
} from "@lumina/ui";
import type { Run } from "@/types/run";

/**
 * The seven modal dialogs owned by RunDetail. Pulled out of the page so
 * the page file can focus on layout + tab orchestration. Each dialog is
 * wired by a `defineModel`-style prop; the parent owns the network
 * mutation, the dialog owns its in-flight form state.
 */
const props = defineProps<{
  run: Run | null;
  // ── notes ────────────────────────────────────────────────────
  notesOpen: boolean;
  notesDraft: string;
  // ── cancel ───────────────────────────────────────────────────
  cancelOpen: boolean;
  cancelConfirm: string;
  // ── delete ───────────────────────────────────────────────────
  deleteOpen: boolean;
  deleteConfirm: string;
  // ── resume ───────────────────────────────────────────────────
  resumeOpen: boolean;
  resumeState: { historyLineCount: number; eventsLineCount: number; logLineCount: number; tags: string[]; config: Record<string, unknown> } | null | undefined;
  isResumeStateLoading: boolean;
  // ── rewind ───────────────────────────────────────────────────
  rewindOpen: boolean;
  rewindMetricName: string;
  rewindMetricValue: number;
  rewindError: string | null;
  // ── alert ────────────────────────────────────────────────────
  alertOpen: boolean;
  alertLevel: "INFO" | "WARN" | "ERROR";
  alertTitle: string;
  alertText: string;
  // ── use-artifact ─────────────────────────────────────────────
  useArtifactOpen: boolean;
  useArtifactVersionId: string;
}>();

const emit = defineEmits<{
  // close hooks — v-model:open support for LDialog
  "update:notesOpen": [v: boolean];
  "update:cancelOpen": [v: boolean];
  "update:deleteOpen": [v: boolean];
  "update:resumeOpen": [v: boolean];
  "update:rewindOpen": [v: boolean];
  "update:alertOpen": [v: boolean];
  "update:useArtifactOpen": [v: boolean];
  // form-input two-way bindings
  "update:notesDraft": [v: string];
  "update:cancelConfirm": [v: string];
  "update:deleteConfirm": [v: string];
  "update:rewindMetricName": [v: string];
  "update:rewindMetricValue": [v: number];
  "update:alertLevel": [v: "INFO" | "WARN" | "ERROR"];
  "update:alertTitle": [v: string];
  "update:alertText": [v: string];
  "update:useArtifactVersionId": [v: string];
  // submit hooks
  submitNotes: [];
  submitCancel: [];
  submitDelete: [];
  submitRewind: [];
  submitAlert: [];
  submitUseArtifact: [];
}>();

// Local helpers that forward to the parent through v-model-style
// events. Naming follows the `update:` convention so the parent can
// use `v-model:notesOpen="ref"`, etc.
const closeNotes = (v: boolean) => emit("update:notesOpen", v);
const closeCancel = (v: boolean) => emit("update:cancelOpen", v);
const closeDelete = (v: boolean) => emit("update:deleteOpen", v);
const closeResume = (v: boolean) => emit("update:resumeOpen", v);
const closeRewind = (v: boolean) => emit("update:rewindOpen", v);
const closeAlert = (v: boolean) => emit("update:alertOpen", v);
const closeUseArtifact = (v: boolean) => emit("update:useArtifactOpen", v);

const canConfirmCancel = computed(
  () => !!props.run && props.cancelConfirm.trim() === props.run.name,
);
const canDelete = computed(
  () => !!props.run && props.deleteConfirm.trim() === props.run.name,
);
</script>

<template>
  <!-- ── Notes ─────────────────────────────────────────────── -->
  <LDialog
    :show="notesOpen"
    title="Edit notes"
    width="600px"
    @update:show="closeNotes"
  >
    <LTextarea
      :value="notesDraft"
      placeholder="Run notes (markdown supported)"
      :rows="10"
      class="!w-full !rounded-md !border !border-border !bg-canvas !p-3 !font-mono !text-xs"
      @update:value="(v: string | null) => emit('update:notesDraft', v ?? '')"
    />
    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton quaternary @click="closeNotes(false)">Cancel</LButton>
        <LButton :loading="false" @click="emit('submitNotes')">Save notes</LButton>
      </div>
    </template>
  </LDialog>

  <!-- ── Cancel ────────────────────────────────────────────── -->
  <LDialog
    :show="cancelOpen"
    title="Cancel this run?"
    width="520px"
    @update:show="closeCancel"
  >
    <div class="space-y-3 text-sm">
      <LAlert type="error" :show-icon="true">
        Cancelling marks the run as <code class="font-mono">killed</code>.
        It cannot be undone.
      </LAlert>
      <div>
        <label class="mb-1 block text-xs font-medium text-fg-secondary">
          Type the run name to confirm.
          <code class="font-mono text-fg-primary">{{ run?.name ?? "" }}</code>
        </label>
        <LInput
          :model-value="cancelConfirm"
          :placeholder="run?.name ?? ''"
          @update:model-value="(v: string | null) => emit('update:cancelConfirm', v ?? '')"
          @keydown.enter="canConfirmCancel && emit('submitCancel')"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton quaternary @click="closeCancel(false)">Keep run</LButton>
        <LButton
          type="error"
          :disabled="!canConfirmCancel"
          @click="emit('submitCancel')"
        >
          Cancel run
        </LButton>
      </div>
    </template>
  </LDialog>

  <!-- ── Delete ────────────────────────────────────────────── -->
  <LDialog
    :show="deleteOpen"
    title="Delete this run?"
    width="520px"
    @update:show="closeDelete"
  >
    <div class="space-y-3 text-sm">
      <LAlert type="error" :show-icon="true">
        Deleting removes the run and its metrics, logs, and artifacts.
        There is no undo.
      </LAlert>
      <div>
        <label class="mb-1 block text-xs font-medium text-fg-secondary">
          Type the run name to confirm.
          <code class="font-mono text-fg-primary">{{ run?.name ?? "" }}</code>
        </label>
        <LInput
          :model-value="deleteConfirm"
          :placeholder="run?.name ?? ''"
          @update:model-value="(v: string | null) => emit('update:deleteConfirm', v ?? '')"
          @keydown.enter="canDelete && emit('submitDelete')"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton quaternary @click="closeDelete(false)">Keep run</LButton>
        <LButton
          type="error"
          :disabled="!canDelete"
          @click="emit('submitDelete')"
        >
          Delete permanently
        </LButton>
      </div>
    </template>
  </LDialog>

  <!-- ── Resume (view-only) ────────────────────────────────── -->
  <LDialog
    :show="resumeOpen"
    title="Resume state"
    width="600px"
    @update:show="closeResume"
  >
    <div v-if="isResumeStateLoading" class="py-8">
      <p class="text-center text-xs text-fg-tertiary">Loading…</p>
    </div>
    <div v-else-if="resumeState" class="space-y-4 text-sm">
      <div class="grid grid-cols-3 gap-3">
        <LCard class="p-3">
          <div class="text-[10px] uppercase tracking-wider text-fg-tertiary">History rows</div>
          <div class="font-mono text-lg">{{ resumeState.historyLineCount }}</div>
        </LCard>
        <LCard class="p-3">
          <div class="text-[10px] uppercase tracking-wider text-fg-tertiary">Events rows</div>
          <div class="font-mono text-lg">{{ resumeState.eventsLineCount }}</div>
        </LCard>
        <LCard class="p-3">
          <div class="text-[10px] uppercase tracking-wider text-fg-tertiary">Log lines</div>
          <div class="font-mono text-lg">{{ resumeState.logLineCount }}</div>
        </LCard>
      </div>
      <div>
        <h4 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-tertiary">Tags</h4>
        <div class="flex flex-wrap gap-2">
          <LTag v-for="tag in resumeState.tags" :key="tag" size="small" round>
            {{ tag }}
          </LTag>
          <span v-if="resumeState.tags.length === 0" class="text-fg-tertiary">No tags</span>
        </div>
      </div>
    </div>
    <p v-else class="py-8 text-center text-sm text-fg-tertiary">
      The run could not be found.
    </p>
    <template #footer>
      <div class="flex justify-end">
        <LButton @click="closeResume(false)">Close</LButton>
      </div>
    </template>
  </LDialog>

  <!-- ── Rewind ────────────────────────────────────────────── -->
  <LDialog
    :show="rewindOpen"
    title="Rewind to a metric value"
    width="520px"
    @update:show="closeRewind"
  >
    <div class="space-y-3 text-sm">
      <p class="text-fg-secondary">
        Lumina truncates the run's history up to the most recent point where
        the named metric last had the value you enter. Useful for recovering
        from a bad late-run write.
      </p>
      <div>
        <label class="mb-1 block text-xs font-medium text-fg-secondary">Metric key</label>
        <LInput
          :model-value="rewindMetricName"
          placeholder="train/loss"
          @update:model-value="(v: string | null) => emit('update:rewindMetricName', v ?? '')"
        />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-fg-secondary">Value</label>
        <LInput
          :model-value="String(rewindMetricValue)"
          placeholder="0.5"
          @update:model-value="(v: string | null) => emit('update:rewindMetricValue', parseFloat(v ?? '') || 0)"
        />
      </div>
      <p v-if="rewindError" class="text-xs text-accent-danger">{{ rewindError }}</p>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton quaternary @click="closeRewind(false)">Cancel</LButton>
        <LButton @click="emit('submitRewind')">Rewind</LButton>
      </div>
    </template>
  </LDialog>

  <!-- ── Alert ─────────────────────────────────────────────── -->
  <LDialog
    :show="alertOpen"
    title="Send an alert"
    width="520px"
    @update:show="closeAlert"
  >
    <div class="space-y-3 text-sm">
      <div>
        <label class="mb-1 block text-xs font-medium text-fg-secondary">Level</label>
        <LSelect
          :model-value="alertLevel"
          :options="[
            { label: 'Info', value: 'INFO' },
            { label: 'Warning', value: 'WARN' },
            { label: 'Error', value: 'ERROR' },
          ]"
          @update:model-value="(v: string) => emit('update:alertLevel', v as 'INFO' | 'WARN' | 'ERROR')"
        />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-fg-secondary">Title</label>
        <LInput
          :model-value="alertTitle"
          placeholder="Loss plateau detected"
          @update:model-value="(v: string | null) => emit('update:alertTitle', v ?? '')"
        />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-fg-secondary">Message</label>
        <LInput
          :model-value="alertText"
          placeholder="train/loss flat for the last 200 steps"
          @update:model-value="(v: string | null) => emit('update:alertText', v ?? '')"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton quaternary @click="closeAlert(false)">Cancel</LButton>
        <LButton @click="emit('submitAlert')">Send</LButton>
      </div>
    </template>
  </LDialog>

  <!-- ── Use-artifact ──────────────────────────────────────── -->
  <LDialog
    :show="useArtifactOpen"
    title="Mark artifact as used by this run"
    width="520px"
    @update:show="closeUseArtifact"
  >
    <div class="space-y-3 text-sm">
      <p class="text-fg-secondary">
        Records the dependency so downstream dashboards can plot lineage
        between the producing artifact and this run.
      </p>
      <div>
        <label class="mb-1 block text-xs font-medium text-fg-secondary">Artifact version ID</label>
        <LInput
          :model-value="useArtifactVersionId"
          placeholder="e.g. 0190a5b8-…-…"
          @update:model-value="(v: string | null) => emit('update:useArtifactVersionId', v ?? '')"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton quaternary @click="closeUseArtifact(false)">Cancel</LButton>
        <LButton @click="emit('submitUseArtifact')">Record use</LButton>
      </div>
    </template>
  </LDialog>
</template>