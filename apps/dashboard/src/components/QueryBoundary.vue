<script setup lang="ts">
/**
 * Renders the error state for a TanStack Query and otherwise yields to the
 * default slot. Keeps the loading/empty states in the page (tables own their
 * skeleton) while giving every list/detail view a consistent, retryable error
 * surface instead of silently showing "no data" when a request actually failed.
 *
 *   <QueryBoundary :is-error="q.isError.value" :error="q.error.value" @retry="q.refetch()">
 *     <MyTable ... />
 *   </QueryBoundary>
 */
import { computed } from "vue";
import { LResult, LButton } from "@lumina/ui";
import { RotateCw } from "lucide-vue-next";
import { ApiError } from "@/services/api";

const props = withDefaults(
  defineProps<{
    isError?: boolean;
    error?: unknown;
    title?: string;
  }>(),
  { isError: false, title: "Something went wrong" },
);

const emit = defineEmits<{ retry: [] }>();

const description = computed(() => {
  const e = props.error;
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) {
      return "You don't have access, or your API key is invalid. Check Settings → API keys.";
    }
    if (e.status === 404) return "The requested resource was not found.";
    if (e.status >= 500) return "The server hit an error. Try again in a moment.";
    return e.message || "The request failed.";
  }
  if (e instanceof Error && e.message) {
    // A bare TypeError("Failed to fetch") means the server is unreachable.
    if (/failed to fetch|networkerror/i.test(e.message)) {
      return "Couldn't reach the Lumina server. Check that it's running and reachable.";
    }
    return e.message;
  }
  return "The request failed unexpectedly.";
});
</script>

<template>
  <div v-if="isError" class="py-8">
    <LResult status="error" :title="title" :description="description">
      <template #footer>
        <LButton @click="emit('retry')">
          <RotateCw class="mr-1 h-3.5 w-3.5" />
          Retry
        </LButton>
      </template>
    </LResult>
  </div>
  <slot v-else />
</template>
