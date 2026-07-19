<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { LCard, LSkeleton, LTag, LButton } from "@lumina/ui";
import { ArrowLeft } from "lucide-vue-next";
import { useArtifact } from "@/modules/artifact/composables/useArtifacts";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const artifactId = computed(() => route.params.artifactId as string);

const { data: artifact, isLoading } = useArtifact(artifactId);
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="`/projects/${projectId}/artifacts`"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to artifacts
    </RouterLink>

    <LSkeleton v-if="isLoading" text :repeat="3" />

    <template v-else-if="artifact">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">{{ artifact.name }}</h1>
          <div class="mt-2 flex items-center gap-2">
            <LTag size="small" type="info">{{ artifact.type }}</LTag>
            <span class="text-sm text-fg-tertiary">
              {{ artifact._count?.versions ?? 0 }} versions
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <LButton>Download</LButton>
        </div>
      </div>

      <LCard title="Versions" class="p-6">
        <p class="text-sm text-fg-tertiary">
          Version list, file tree, and lineage will appear here.
        </p>
      </LCard>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Artifact not found.
    </LCard>
  </div>
</template>