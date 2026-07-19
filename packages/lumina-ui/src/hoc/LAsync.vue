<script setup lang="ts" generic="T">
import { watchEffect } from "vue";
import LSpinner from "../primitives/LSpinner.vue";
import LEmpty from "../primitives/LEmpty.vue";
import LResult from "../primitives/LResult.vue";
import { useWidgetData } from "../composables/useWidgetData";

export interface LAsyncProps<T> {
  /** 异步任务，返回数据 */
  task?: () => Promise<T>;
  /** 是否立即执行 */
  immediate?: boolean;
  /** 加载中显示文本 */
  loadingText?: string;
  /** 空数据描述 */
  emptyDescription?: string;
  /** 错误标题 */
  errorTitle?: string;
}

const props = withDefaults(defineProps<LAsyncProps<T>>(), {
  immediate: true,
  emptyDescription: "No data",
  errorTitle: "Failed to load",
});

const emit = defineEmits<{
  loaded: [data: T];
  error: [error: Error];
}>();

const { data, loading, error, refresh } = useWidgetData<T>({
  fetcher: props.task,
  immediate: props.immediate,
});

watchEffect(() => {
  if (data.value !== undefined) {
    emit("loaded", data.value as T);
  }
  if (error.value) {
    emit("error", error.value);
  }
});
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
