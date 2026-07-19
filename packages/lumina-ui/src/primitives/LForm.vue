<script setup lang="ts">
export interface LFormProps {
  /** 是否水平布局 */
  inline?: boolean;
  /** 标签宽度，仅非 inline 时有效 */
  labelWidth?: string | number;
  /** 标签位置 */
  labelPosition?: "top" | "left" | "right";
  /** 是否禁用内部所有表单控件 */
  disabled?: boolean;
}

const props = withDefaults(defineProps<LFormProps>(), {
  labelPosition: "top",
});

const emit = defineEmits<{
  submit: [event: Event];
}>();

function handleSubmit(event: Event) {
  event.preventDefault();
  emit("submit", event);
}
</script>

<template>
  <form
    :class="[
      'space-y-4',
      props.inline ? 'flex flex-wrap items-start gap-4 space-y-0' : '',
    ]"
    :style="
      props.labelWidth && !props.inline
        ? { '--l-form-label-width': typeof props.labelWidth === 'number' ? `${props.labelWidth}px` : props.labelWidth }
        : undefined
    "
    @submit="handleSubmit"
  >
    <fieldset :disabled="props.disabled" class="contents">
      <slot />
    </fieldset>
  </form>
</template>

<style>
.l-form-item {
  display: grid;
  gap: 0.375rem;
}

.l-form-item--horizontal {
  grid-template-columns: var(--l-form-label-width, 120px) 1fr;
  align-items: center;
  gap: 1rem;
}

.l-form-item__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.l-form-item__help {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.l-form-item__error {
  font-size: 0.75rem;
  color: hsl(var(--error));
}
</style>
