<script setup lang="ts">
import { computed } from "vue";

export interface LMetricValueProps {
  value?: number | string | null;
  /** 保留小数位数 */
  precision?: number;
  /** 是否使用千分位 */
  thousands?: boolean;
  /** 后缀，例如 "%" */
  suffix?: string;
  /** 空值占位 */
  placeholder?: string;
}

const props = withDefaults(defineProps<LMetricValueProps>(), {
  placeholder: "—",
});

const formatted = computed(() => {
  if (props.value === undefined || props.value === null || props.value === "") {
    return props.placeholder;
  }

  if (typeof props.value === "string") {
    return props.value;
  }

  if (props.precision !== undefined) {
    const fixed = props.value.toFixed(props.precision);
    return props.thousands ? formatThousands(fixed) : fixed;
  }

  const str = String(props.value);
  return props.thousands ? formatThousands(str) : str;
});

function formatThousands(value: string): string {
  const [integer, fraction] = value.split(".");
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction !== undefined ? `${formattedInteger}.${fraction}` : formattedInteger;
}
</script>

<template>
  <span class="font-medium tabular-nums">
    {{ formatted }}
    <span v-if="suffix && value !== undefined && value !== null && value !== ''" class="text-muted-foreground">
      {{ suffix }}
    </span>
  </span>
</template>
