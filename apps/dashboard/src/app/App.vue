<script setup lang="ts">
import { Toaster } from "vue-sonner";
import { RouterView } from "vue-router";
</script>

<template>
  <RouterView />
  <Toaster rich-colors position="top-right" />
</template>
