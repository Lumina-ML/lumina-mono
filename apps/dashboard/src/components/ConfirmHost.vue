<script setup lang="ts">
/**
 * Singleton host for the `useConfirm()` service. Mount exactly once at the app
 * root. Renders the shared confirmation dialog whenever a call site awaits
 * `confirm({...})`.
 */
import { LDialog, LButton } from "@lumina/ui";
import { AlertTriangle } from "lucide-vue-next";
import { useConfirmHost } from "@/composables/useConfirm";

const { state, settle } = useConfirmHost();
</script>

<template>
  <LDialog
    :show="state.open"
    :title="state.title"
    width="440px"
    @update:show="(v: boolean) => { if (!v) settle(false); }"
  >
    <div class="space-y-3">
      <div
        v-if="state.tone !== 'default' && state.message"
        :class="[
          'flex items-start gap-2 rounded-md p-3 text-xs',
          state.tone === 'danger'
            ? 'border border-accent-danger/30 bg-accent-danger/10'
            : 'border border-accent-warning/30 bg-accent-warning/10',
        ]"
      >
        <AlertTriangle
          :class="[
            'mt-0.5 h-4 w-4 flex-shrink-0',
            state.tone === 'danger' ? 'text-accent-danger' : 'text-accent-warning',
          ]"
        />
        <div class="whitespace-pre-wrap">{{ state.message }}</div>
      </div>
      <p v-else-if="state.message" class="whitespace-pre-wrap text-sm text-fg-secondary">
        {{ state.message }}
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton quaternary @click="settle(false)">{{ state.cancelText }}</LButton>
        <LButton
          :type="state.tone === 'danger' ? 'error' : state.tone === 'warning' ? 'warning' : 'primary'"
          @click="settle(true)"
        >
          {{ state.confirmText }}
        </LButton>
      </div>
    </template>
  </LDialog>
</template>
