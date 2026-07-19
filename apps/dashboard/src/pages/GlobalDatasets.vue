<script setup lang="ts">
import ComingSoon from "@/components/ComingSoon.vue";
</script>

<template>
  <ComingSoon
    feature="Datasets"
    summary="A workspace-wide view of all dataset artifacts across projects. Use a project's Artifacts tab in the meantime to browse datasets scoped to that project."
    fallback-to="/projects"
    fallback-label="Browse projects"
  />
</template>