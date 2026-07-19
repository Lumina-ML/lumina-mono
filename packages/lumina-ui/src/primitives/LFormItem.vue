<script setup lang="ts">
export interface LFormItemProps {
  label?: string;
  required?: boolean;
  error?: string;
  help?: string;
  /** 是否水平排列 label 与控件 */
  horizontal?: boolean;
}

const props = defineProps<LFormItemProps>();
</script>

<template>
  <div
    :class="[
      'l-form-item',
      props.horizontal ? 'l-form-item--horizontal' : '',
    ]"
  >
    <label v-if="props.label" class="l-form-item__label">
      {{ props.label }}
      <span v-if="props.required" class="text-error" aria-hidden="true">*</span>
    </label>
    <div class="flex flex-col gap-1">
      <slot />
      <p v-if="props.error" class="l-form-item__error" role="alert">
        {{ props.error }}
      </p>
      <p v-else-if="props.help" class="l-form-item__help">
        {{ props.help }}
      </p>
    </div>
  </div>
</template>
