<script setup lang="ts">
import { RouterLink } from "vue-router";
import { LCard, LButton } from "@lumina/ui";
</script>

<template>
  <LCard title="Quick Start">
    <p class="mb-4 text-muted-foreground">
      Run an experiment with the Python SDK to see data here.
    </p>
    <pre class="overflow-x-auto rounded-md bg-muted p-3 text-sm">
import lumina
lumina.init(project='demo', name='exp-001')
lumina.log({'loss': 0.9, 'acc': 0.1}, step=0)
lumina.finish()
    </pre>
    <template #footer>
      <RouterLink to="/projects">
        <LButton type="primary">View Projects</LButton>
      </RouterLink>
    </template>
  </LCard>
</template>
