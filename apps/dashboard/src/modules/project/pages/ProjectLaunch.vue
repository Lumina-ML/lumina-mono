<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { LCard, LEmpty } from "@lumina/ui";
import { Rocket } from "lucide-vue-next";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
void projectId;
</script>

<template>
  <LCard class="p-8">
    <LEmpty
      title="Launch queue"
      description="Submit jobs to remote agents from this project. The launch monitor shows queue depth, agent status, and job history."
      :icon="Rocket"
    />
  </LCard>
</template>