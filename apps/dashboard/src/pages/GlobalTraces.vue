<script setup lang="ts">
import ComingSoon from "@/components/ComingSoon.vue";
</script>

<template>
  <ComingSoon
    feature="Traces"
    summary="A workspace-wide view of every LLM/agent trace across projects. Use a project's Traces tab in the meantime to browse traces scoped to that project."
    fallback-to="/projects"
    fallback-label="Browse projects"
  />
</template>