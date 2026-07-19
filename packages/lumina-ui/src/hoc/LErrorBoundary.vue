<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";
import LResult from "../primitives/LResult.vue";

export interface LErrorBoundaryProps {
  title?: string;
  description?: string;
}

withDefaults(defineProps<LErrorBoundaryProps>(), {
  title: "Something went wrong",
  description: "An unexpected error occurred in this component.",
});

const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err));
  return false;
});

function reset() {
  error.value = null;
}
</script>

<template>
  <LResult
    v-if="error"
    status="error"
    :title="title"
    :description="error?.message || description"
  >
    <template #footer>
      <slot name="action" :error="error" :reset="reset">
        <button
          type="button"
          class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          @click="reset"
        >
          Retry
        </button>
      </slot>
    </template>
  </LResult>
  <slot v-else />
</template>
