<script setup lang="ts">
import ComingSoon from "@/components/ComingSoon.vue";
</script>

<template>
  <ComingSoon
    feature="Reports"
    summary="A workspace-wide view of every report across projects. Use a project's Reports tab in the meantime to browse reports scoped to that project."
    fallback-to="/projects"
    fallback-label="Browse projects"
  />
</template>