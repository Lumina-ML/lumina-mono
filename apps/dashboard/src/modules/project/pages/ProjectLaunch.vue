<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import LaunchMonitor from "@/modules/launch/pages/LaunchMonitor.vue";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
</script>

<template>
  <LaunchMonitor :project-id="projectId" />
</template>
