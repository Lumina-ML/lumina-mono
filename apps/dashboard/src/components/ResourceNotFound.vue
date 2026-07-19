<script setup lang="ts">
import { LCard, LEmpty } from "@lumina/ui";
import { FileX2 } from "lucide-vue-next";

interface Props {
  /** "Run", "Artifact", "Trace", etc. — capitalised, singular. */
  resource: string;
  /** Optional secondary copy below the heading. */
  description?: string;
  /** Back-link target. If omitted, no link is rendered. */
  backTo?: string;
  backLabel?: string;
}

withDefaults(defineProps<Props>(), {
  description: undefined,
  backTo: "/",
  backLabel: "Back to home",
});
</script>

<template>
  <LCard class="p-0">
    <div class="flex items-center justify-center p-10">
      <LEmpty
        :title="`${resource} not found`"
        :description="description ?? `This ${resource.toLowerCase()} may have been deleted or the link is stale.`"
      >
        <template #icon>
          <FileX2 class="h-12 w-12 text-fg-tertiary" />
        </template>
        <template v-if="backTo" #actions>
          <a
            :href="backTo"
            class="text-xs text-accent-primary hover:underline"
          >
            {{ backLabel }} →
          </a>
        </template>
      </LEmpty>
    </div>
  </LCard>
</template>
