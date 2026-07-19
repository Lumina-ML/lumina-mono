<script setup lang="ts">
import { RouterLink } from "vue-router";
import { LCard, LButton, LTag } from "@lumina/ui";
import { Construction, ArrowRight, Layers } from "lucide-vue-next";

interface Props {
  /** Short heading, e.g. "Datasets", "Traces". */
  feature: string;
  /** One-line summary of what this view will eventually show. */
  summary: string;
  /**
   * Where to send users in the meantime. If omitted, no CTA is rendered.
   * Most pages point to the project-scoped version of the same feature,
   * since that already works end-to-end.
   */
  fallbackTo?: string;
  /** Label for the fallback CTA. Defaults to "Browse projects". */
  fallbackLabel?: string;
}

withDefaults(defineProps<Props>(), {
  fallbackTo: "/projects",
  fallbackLabel: "Browse projects",
});
</script>

<template>
  <div class="mx-auto max-w-2xl py-12">
    <LCard class="p-10 text-center">
      <div
        class="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-warning/15 text-accent-warning"
      >
        <Construction class="h-6 w-6" />
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">{{ feature }}</h1>
      <p class="mt-2 text-sm text-fg-tertiary">{{ summary }}</p>

      <div class="mt-4 flex items-center justify-center gap-2">
        <LTag size="small" type="warning">
          <Layers class="mr-1 inline h-3 w-3" />
          Workspace-wide view coming soon
        </LTag>
      </div>

      <div class="mt-6 flex items-center justify-center gap-3">
        <RouterLink :to="fallbackTo">
          <LButton type="primary">
            {{ fallbackLabel }}
            <ArrowRight class="ml-1 h-4 w-4" />
          </LButton>
        </RouterLink>
        <RouterLink to="/">
          <LButton quaternary>Back to overview</LButton>
        </RouterLink>
      </div>
    </LCard>
  </div>
</template>