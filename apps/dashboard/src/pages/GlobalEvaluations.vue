<script setup lang="ts">
import ComingSoon from "@/components/ComingSoon.vue";
</script>

<template>
  <ComingSoon
    feature="Evaluations"
    summary="A workspace-wide view of every evaluation across projects. Use a project's Evaluations tab in the meantime to browse evaluations scoped to that project."
    fallback-to="/projects"
    fallback-label="Browse projects"
  />
</template>