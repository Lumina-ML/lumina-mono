<script setup lang="ts">
import { LCard, LButton, LTag } from "@lumina/ui";
import {
  Star,
  Heart,
  Map,
  Github,
  BookOpen,
  Bug,
} from "lucide-vue-next";

interface CommunityLink {
  icon: typeof Star;
  title: string;
  description: string;
  href: string;
  cta: string;
  tag?: string;
}

const links: CommunityLink[] = [
  {
    icon: Star,
    title: "Star the repo",
    description:
      "Lumina is open-source under Apache 2.0. A star helps others find it and keeps us motivated.",
    href: "https://github.com/Lumina-ML/lumina",
    cta: "Star on GitHub",
    tag: "Free",
  },
  {
    icon: Heart,
    title: "Sponsor development",
    description:
      "Fund roadmap work, priority bug fixes, or new infrastructure adapters (S3, K8s, OTel, …).",
    href: "https://github.com/sponsors/Lumina-ML",
    cta: "Become a sponsor",
  },
  {
    icon: Map,
    title: "Roadmap",
    description:
      "See what's shipping next and vote on what we should build. Public roadmap, quarterly refresh.",
    href: "https://github.com/Lumina-ML/lumina-mono",
    cta: "View roadmap",
  },
];

const resources = [
  {
    icon: BookOpen,
    label: "Documentation",
    // TODO
    href: "https://docs.lumina.ai",
  },
  { icon: Github, label: "Source code", href: "https://github.com/Lumina-ML/lumina" },
  {
    icon: Bug,
    label: "Report a bug",
    href: "https://github.com/Lumina-ML/lumina-mono/issues",
  },
];
</script>

<template>
  <div class="space-y-6">
    <LCard class="p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="max-w-2xl">
          <div
            class="text-xs font-medium uppercase tracking-wider text-fg-tertiary"
          >
            Lumina is community-built
          </div>
          <h2 class="mt-1 text-2xl font-semibold">
            Open-source MLOps, self-hosted.
          </h2>
          <p class="mt-2 text-sm text-fg-tertiary">
            There is no plan to upgrade and no invoice to pay. Lumina ships under
            Apache 2.0 and runs on your infrastructure. The dashboard you're
            looking at is the same binary the maintainers use every day.
          </p>
        </div>
        <LTag type="success" size="small">Apache 2.0</LTag>
      </div>
    </LCard>

    <div class="grid gap-4 sm:grid-cols-2">
      <LCard
        v-for="link in links"
        :key="link.title"
        class="flex flex-col gap-3 p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-primary/10 text-accent-primary"
          >
            <component :is="link.icon" class="h-4 w-4" />
          </div>
          <LTag v-if="link.tag" size="small" type="primary">
            {{ link.tag }}
          </LTag>
        </div>
        <div class="space-y-1">
          <h3 class="text-base font-semibold">{{ link.title }}</h3>
          <p class="text-sm text-fg-tertiary">{{ link.description }}</p>
        </div>
        <div class="mt-auto pt-2">
          <a
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-block"
          >
            <LButton size="sm">
              {{ link.cta }}
              <span aria-hidden="true" class="ml-1">↗</span>
            </LButton>
          </a>
        </div>
      </LCard>
    </div>

    <LCard class="p-5">
      <h3 class="text-sm font-medium">More resources</h3>
      <p class="mt-1 text-xs text-fg-tertiary">
        Docs, source, and issue tracker — everything lives on GitHub.
      </p>
      <ul class="mt-3 flex flex-wrap gap-2">
        <li v-for="r in resources" :key="r.label">
          <a
            :href="r.href"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-md border border-border bg-canvas px-2.5 py-1 text-xs font-medium text-fg-secondary transition-colors hover:border-accent-primary/40 hover:text-fg-primary"
          >
            <component :is="r.icon" class="h-3.5 w-3.5" />
            {{ r.label }}
          </a>
        </li>
      </ul>
    </LCard>
  </div>
</template>