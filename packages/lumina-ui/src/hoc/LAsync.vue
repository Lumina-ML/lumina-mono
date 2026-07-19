<script setup lang="ts">
import { ref, watch } from "vue";
import LSpinner from "../primitives/LSpinner.vue";
import LEmpty from "../primitives/LEmpty.vue";
import LResult from "../primitives/LResult.vue";

export interface LAsyncProps {
  /** 异步任务，返回数据 */
  task?: () => Promise<unknown>;
  /** 是否立即执行 */
  immediate?: boolean;
  /** 加载中显示文本 */
  loadingText?: string;
  /** 空数据描述 */
  emptyDescription?: string;
  /** 错误标题 */
  errorTitle?: string;
}

const props = withDefaults(defineProps<LAsyncProps>(), {
  immediate: true,
  emptyDescription: "No data",
  errorTitle: "Failed to load",
});

const emit = defineEmits<{
  loaded: [data: unknown];
  error: [error: Error];
}>();

const data = ref<unknown | undefined>(undefined);
const loading = ref(false);
const error = ref<Error | null>(null);

async function refresh() {
  if (!props.task) return;
  loading.value = true;
  error.value = null;
  try {
    data.value = await props.task();
    emit("loaded", data.value);
  } catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err));
    emit("error", error.value);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.task,
  () => {
    if (props.immediate) {
      refresh();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="relative min-h-[80px]">
    <div v-if="loading" class="flex h-full flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
      <LSpinner />
      <span v-if="loadingText" class="text-sm">{{ loadingText }}</span>
    </div>

    <LResult
      v-else-if="error"
      status="error"
      :title="errorTitle"
      :description="error?.message"
    >
      <template #footer>
        <slot name="error-action" :refresh="refresh">
          <button
            type="button"
            class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            @click="refresh"
          >
            Retry
          </button>
        </slot>
      </template>
    </LResult>

    <LEmpty v-else-if="!data" :description="emptyDescription">
      <slot name="empty-extra" />
    </LEmpty>

    <slot v-else :data="data" :refresh="refresh" />
  </div>
</template>
