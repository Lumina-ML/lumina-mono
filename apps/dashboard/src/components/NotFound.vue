<script setup lang="ts">
import { LButton, LResult } from "@lumina/ui";
import { RouterLink } from "vue-router";
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <LResult status="404" title="404 Not Found" description="The page you are looking for does not exist.">
      <template #footer>
        <RouterLink to="/">
          <LButton>Back to Home</LButton>
        </RouterLink>
      </template>
    </LResult>
  </div>
</template>
