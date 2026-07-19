<script setup lang="ts">
import { computed } from "vue";
import { NDrawer, NDrawerContent } from "naive-ui";

export interface LDrawerProps {
  show?: boolean;
  title?: string;
  width?: string | number;
  placement?: "left" | "right" | "top" | "bottom";
  maskClosable?: boolean;
  closable?: boolean;
  defaultHeight?: string | number;
}

const props = withDefaults(defineProps<LDrawerProps>(), {
  placement: "right",
  maskClosable: true,
  closable: true,
});

const emit = defineEmits<{
  "update:show": [value: boolean];
  close: [];
}>();

function handleUpdate(value: boolean) {
  emit("update:show", value);
  if (!value) emit("close");
}

const drawerWidth = computed(() => {
  if (props.placement === "top" || props.placement === "bottom") return "100%";
  return props.width ?? 380;
});

const drawerHeight = computed(() => {
  if (props.placement === "left" || props.placement === "right") return "100%";
  return props.defaultHeight ?? 380;
});
</script>

<template>
  <NDrawer
    :show="props.show"
    :width="drawerWidth"
    :height="drawerHeight"
    :placement="props.placement"
    :mask-closable="props.maskClosable"
    :close-on-esc="props.closable"
    @update:show="handleUpdate"
  >
    <NDrawerContent :title="props.title" :closable="props.closable">
      <template v-for="(_, name) in $slots" #[name]>
        <slot :name="name" />
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
