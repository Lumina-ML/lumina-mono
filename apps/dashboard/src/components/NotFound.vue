<script setup lang="ts">
import { NButton, NResult } from "naive-ui";
import { RouterLink } from "vue-router";
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <NResult status="404" title="404 Not Found" description="The page you are looking for does not exist.">
      <template #footer>
        <RouterLink to="/">
          <NButton>Back to Home</NButton>
        </RouterLink>
      </template>
    </NResult>
  </div>
</template>
