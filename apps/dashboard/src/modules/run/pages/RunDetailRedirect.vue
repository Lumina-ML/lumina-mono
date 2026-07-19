<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { LSpinner } from "@lumina/ui";
import { RunService } from "@/services/run.service";

const route = useRoute();
const router = useRouter();

const runId = computed(() => route.params.runId as string);

async function redirect() {
  if (!runId.value) return;
  try {
    const run = await RunService.get(runId.value);
    if (run?.projectId && run?.runId) {
      router.replace(`/projects/${run.projectId}/runs/${run.runId}`);
    } else {
      router.replace({ name: "NotFound" });
    }
  } catch {
    router.replace({ name: "NotFound" });
  }
}

onMounted(redirect);
watch(runId, redirect);
</script>

<template>
  <div class="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-fg-tertiary">
    <LSpinner size="sm" />
    Redirecting…
  </div>
</template>