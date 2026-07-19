<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { LCard, LEmpty, LTag } from "@lumina/ui";
import { Rocket } from "lucide-vue-next";
import { useProject } from "@/modules/project/composables/useProjects";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const { data: project } = useProject(projectId);
</script>

<template>
  <div class="space-y-3">
    <LCard class="p-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Rocket class="h-4 w-4 text-fg-tertiary" />
          <h3 class="text-sm font-medium">Project-scoped launch</h3>
        </div>
        <LTag size="small" type="info">
          Viewing {{ project?.name ?? projectId }}
        </LTag>
      </div>
      <p class="mt-2 text-xs text-fg-tertiary">
        The launch monitor at <code class="font-mono">/launch</code> shows
        queues across all projects. To scope to this project only, pick it
        from the project picker there.
      </p>
    </LCard>

    <LCard class="p-8">
      <LEmpty
        title="Per-project launch monitor"
        description="A scoped view will surface here once you connect this project to a queue. For now, the global Launch Monitor shows everything."
        :icon="Rocket"
      />
    </LCard>
  </div>
</template>