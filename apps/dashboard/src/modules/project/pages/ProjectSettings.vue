<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { LCard, LEmpty } from "@lumina/ui";
import { Settings as SettingsIcon } from "lucide-vue-next";
import { useProject } from "@/modules/project/composables/useProjects";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const { data: project } = useProject(projectId);
</script>

<template>
  <LCard class="p-8">
    <LEmpty
      :title="project ? `Settings for ${project.name}` : 'Project settings'"
      description="Configure project-level metadata, default run configs, retention, and integrations."
      :icon="SettingsIcon"
    />
  </LCard>
</template>