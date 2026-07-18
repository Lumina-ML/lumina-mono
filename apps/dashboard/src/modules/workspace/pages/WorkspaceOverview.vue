<script setup lang="ts">
import { NSpace, NCard, NStatistic, NButton } from "naive-ui";
import { FolderKanban, PlayCircle, Box } from "lucide-vue-next";
import { RouterLink } from "vue-router";
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Workspace Overview</h1>
      <p class="text-muted-foreground">Welcome to Lumina — your AI/ML control plane.</p>
    </div>

    <NSpace>
      <NCard>
        <NStatistic label="Projects" :value="0">
          <template #prefix>
            <FolderKanban class="w-4 h-4 inline" />
          </template>
        </NStatistic>
      </NCard>
      <NCard>
        <NStatistic label="Runs" :value="0">
          <template #prefix>
            <PlayCircle class="w-4 h-4 inline" />
          </template>
        </NStatistic>
      </NCard>
      <NCard>
        <NStatistic label="Artifacts" :value="0">
          <template #prefix>
            <Box class="w-4 h-4 inline" />
          </template>
        </NStatistic>
      </NCard>
    </NSpace>

    <NCard title="Get started">
      <p class="text-muted-foreground mb-4">
        Run an experiment with the Python SDK to see data here.
      </p>
      <pre class="bg-muted p-3 rounded-md text-sm overflow-x-auto">
import lumina
lumina.init(project='demo', name='exp-001')
lumina.log({'loss': 0.9, 'acc': 0.1}, step=0)
lumina.finish()
      </pre>
      <template #footer>
        <RouterLink to="/projects">
          <NButton type="primary">View Projects</NButton>
        </RouterLink>
      </template>
    </NCard>
  </div>
</template>
