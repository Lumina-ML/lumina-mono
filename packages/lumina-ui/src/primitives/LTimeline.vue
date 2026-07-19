<script setup lang="ts">
import { NTimeline, NTimelineItem } from "naive-ui";

export interface LTimelineEvent {
  title?: string;
  content?: string;
  time?: string;
  type?: "default" | "success" | "info" | "warning" | "error";
  lineType?: "default" | "dashed";
}

export interface LTimelineProps {
  events?: LTimelineEvent[];
  horizontal?: boolean;
}

const props = withDefaults(defineProps<LTimelineProps>(), {
  horizontal: false,
});
</script>

<template>
  <NTimeline :horizontal="props.horizontal">
    <NTimelineItem
      v-for="(event, index) in props.events"
      :key="index"
      :title="event.title"
      :content="event.content"
      :time="event.time"
      :type="event.type"
      :line-type="event.lineType"
    />
  </NTimeline>
</template>
