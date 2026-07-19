<script setup lang="ts">
import ComingSoon from "@/components/ComingSoon.vue";
</script>

<template>
  <ComingSoon
    feature="Sweeps"
    summary="A workspace-wide view of every hyperparameter sweep across projects. Use a project's Sweeps tab in the meantime to browse sweeps scoped to that project."
    fallback-to="/projects"
    fallback-label="Browse projects"
  />
</template>