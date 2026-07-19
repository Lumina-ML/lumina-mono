<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

export interface LMarkdownProps {
  /** Markdown source string. */
  source?: string;
  /** Sanitize rendered HTML with DOMPurify. */
  sanitize?: boolean;
}

const props = withDefaults(defineProps<LMarkdownProps>(), {
  source: "",
  sanitize: true,
});

const html = computed(() => {
  const raw = marked.parse(props.source, { async: false }) as string;
  return props.sanitize ? DOMPurify.sanitize(raw) : raw;
});
</script>

<template>
  <div class="l-markdown text-foreground" v-html="html" />
</template>

<style scoped>
.l-markdown {
  line-height: 1.625;
}

.l-markdown :deep(h1),
.l-markdown :deep(h2),
.l-markdown :deep(h3),
.l-markdown :deep(h4),
.l-markdown :deep(h5),
.l-markdown :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.75em;
  font-weight: 600;
  line-height: 1.25;
  color: hsl(var(--foreground));
}

.l-markdown :deep(h1) {
  font-size: 1.75rem;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.25em;
}

.l-markdown :deep(h2) {
  font-size: 1.5rem;
  border-bottom: 1px solid hsl(var(--border));
  padding-bottom: 0.25em;
}

.l-markdown :deep(h3) {
  font-size: 1.25rem;
}

.l-markdown :deep(h4) {
  font-size: 1.125rem;
}

.l-markdown :deep(p) {
  margin-top: 0;
  margin-bottom: 1em;
}

.l-markdown :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.l-markdown :deep(a:hover) {
  color: hsl(var(--accent));
}

.l-markdown :deep(ul),
.l-markdown :deep(ol) {
  margin-top: 0;
  margin-bottom: 1em;
  padding-left: 1.5em;
}

.l-markdown :deep(li) {
  margin-bottom: 0.25em;
}

.l-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875em;
  padding: 0.125em 0.375em;
  border-radius: calc(var(--radius) / 2);
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.l-markdown :deep(pre) {
  margin-top: 0;
  margin-bottom: 1em;
  padding: 0.75em 1em;
  overflow-x: auto;
  border-radius: var(--radius);
  background-color: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
}

.l-markdown :deep(pre code) {
  padding: 0;
  background-color: transparent;
  border-radius: 0;
}

.l-markdown :deep(blockquote) {
  margin: 0 0 1em;
  padding-left: 1em;
  border-left: 3px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
}

.l-markdown :deep(hr) {
  margin: 1.5em 0;
  border: 0;
  border-top: 1px solid hsl(var(--border));
}

.l-markdown :deep(table) {
  width: 100%;
  margin-bottom: 1em;
  border-collapse: collapse;
  font-size: 0.875em;
}

.l-markdown :deep(th),
.l-markdown :deep(td) {
  padding: 0.5em 0.75em;
  border: 1px solid hsl(var(--border));
  text-align: left;
}

.l-markdown :deep(th) {
  background-color: hsl(var(--muted));
  font-weight: 600;
}

.l-markdown :deep(tr:nth-child(even)) {
  background-color: hsl(var(--muted) / 0.3);
}

.l-markdown :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius);
}
</style>
