<script setup lang="ts">
import { computed } from "vue";
import { NButton } from "naive-ui";
import type { ButtonProps } from "naive-ui";

export interface LButtonProps {
  /** 语义化尺寸，与 Tailwind 命名对齐 */
  size?: "xs" | "sm" | "md" | "lg";
  /** naive-ui 按钮类型 */
  type?: ButtonProps["type"];
  loading?: boolean;
  disabled?: boolean;
  /** 透明背景，悬停显示背景 */
  quaternary?: boolean;
  /** 透明背景，边框样式 */
  ghost?: boolean;
  /** 纯文本按钮 */
  text?: boolean;
  /** 虚线边框 */
  dashed?: boolean;
  /** 圆角胶囊 */
  round?: boolean;
  /** 圆形 */
  circle?: boolean;
  /** 原生 button type */
  attrType?: "button" | "submit" | "reset";
  /** 块级按钮 */
  block?: boolean;
}

const props = withDefaults(defineProps<LButtonProps>(), {
  size: "md",
  type: "default",
  attrType: "button",
});

const sizeMap = {
  xs: "tiny",
  sm: "small",
  md: "medium",
  lg: "large",
} as const satisfies Record<string, ButtonProps["size"]>;

const buttonProps = computed<ButtonProps>(() => ({
  type: props.type,
  size: sizeMap[props.size],
  loading: props.loading,
  disabled: props.disabled,
  quaternary: props.quaternary,
  ghost: props.ghost,
  text: props.text,
  dashed: props.dashed,
  round: props.round,
  circle: props.circle,
  attrType: props.attrType,
  block: props.block,
}));
</script>

<template>
  <NButton v-bind="buttonProps" class="l-button">
    <slot />
  </NButton>
</template>

<style scoped>
.l-button {
  /* 确保触摸设备上的可点击区域至少 44x44 */
  min-height: 44px;
  min-width: 44px;
}

@media (pointer: fine) {
  .l-button {
    min-height: auto;
    min-width: auto;
  }
}
</style>
