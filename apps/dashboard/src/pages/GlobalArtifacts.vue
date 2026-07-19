<script setup lang="ts">
import ComingSoon from "@/components/ComingSoon.vue";
</script>

<template>
  <ComingSoon
    feature="Artifacts"
    summary="A workspace-wide view of every artifact across projects. Use a project's Artifacts tab in the meantime to browse artifacts scoped to that project."
    fallback-to="/projects"
    fallback-label="Browse projects"
  />
</template>