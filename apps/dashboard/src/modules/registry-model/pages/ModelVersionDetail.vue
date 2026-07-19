<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { LCard, LTag, LButton } from "@lumina/ui";
import { ArrowLeft } from "lucide-vue-next";

const route = useRoute();
const name = computed(() => route.params.name as string);
const version = computed(() => route.params.version as string);
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      to="/models"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to model registry
    </RouterLink>

    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ name }} <span class="font-mono text-fg-tertiary">v{{ version }}</span>
        </h1>
        <div class="mt-2 flex items-center gap-2">
          <LTag size="small" type="success">Production</LTag>
          <LTag size="small" type="default">@prod</LTag>
        </div>
      </div>
      <div class="flex gap-2">
        <LButton>Deploy</LButton>
      </div>
    </div>

    <LCard class="p-6">
      <p class="text-sm text-fg-tertiary">
        Overview, schema, lineage, evaluations, and deployments will appear here.
      </p>
    </LCard>
  </div>
</template>