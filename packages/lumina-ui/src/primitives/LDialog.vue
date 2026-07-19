<script setup lang="ts">
import { NModal } from "naive-ui";

export interface LDialogProps {
  show?: boolean;
  title?: string;
  width?: string | number;
  maskClosable?: boolean;
  closable?: boolean;
  preset?: "dialog" | "card";
  positiveText?: string;
  negativeText?: string;
  loading?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<LDialogProps>(), {
  preset: "card",
  maskClosable: true,
  closable: true,
});

const emit = defineEmits<{
  "update:show": [value: boolean];
  positiveClick: [];
  negativeClick: [];
  close: [];
}>();

function handleUpdateShow(value: boolean) {
  emit("update:show", value);
  if (!value) emit("close");
}
</script>

<template>
  <NModal
    :show="props.show"
    :title="props.title"
    :width="props.width ?? 520"
    :mask-closable="props.maskClosable"
    :closable="props.closable"
    :preset="props.preset"
    :positive-text="props.positiveText"
    :negative-text="props.negativeText"
    :positive-button-props="{ loading: props.loading, disabled: props.disabled }"
    @update:show="handleUpdateShow"
    @positive-click="$emit('positiveClick')"
    @negative-click="$emit('negativeClick')"
  >
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name" />
    </template>
  </NModal>
</template>
