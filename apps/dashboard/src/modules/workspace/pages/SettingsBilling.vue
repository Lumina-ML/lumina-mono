<script setup lang="ts">
import {
  LCard,
  LTag,
  LButton,
  LStatistic,
} from "@lumina/ui";
import { CreditCard, FileText, TrendingUp } from "lucide-vue-next";

interface UsageMeter {
  label: string;
  used: number;
  limit: number;
  unit: string;
}

const usage: UsageMeter[] = [
  { label: "Tracked runs", used: 1284, limit: 5000, unit: "runs" },
  { label: "Stored metrics", used: 21.4, limit: 50, unit: "GB" },
  { label: "Artifact storage", used: 4.2, limit: 25, unit: "GB" },
  { label: "Team seats", used: 3, limit: 10, unit: "seats" },
];

function pct(m: UsageMeter): number {
  return Math.min(100, Math.round((m.used / m.limit) * 100));
}

const plan = {
  name: "Team",
  price: "$99 / month",
  renewal: "Renews on Aug 19, 2026",
};
</script>

<template>
  <div class="space-y-4">
    <LCard class="p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="text-xs font-medium uppercase tracking-wider text-fg-tertiary">
            Current plan
          </div>
          <h2 class="mt-1 text-2xl font-semibold">{{ plan.name }}</h2>
          <p class="mt-1 text-sm text-fg-tertiary">
            {{ plan.renewal }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <LTag type="primary" size="small">Active</LTag>
          <LButton quaternary>
            <CreditCard class="mr-1 h-3 w-3" />
            Update payment method
          </LButton>
          <LButton>Manage plan</LButton>
        </div>
      </div>
    </LCard>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <LCard v-for="m in usage" :key="m.label" class="p-4">
        <LStatistic :label="m.label" :value="`${m.used}${m.unit === 'GB' ? '' : ''}`">
          <template #suffix>
            <span class="font-mono text-xs text-fg-tertiary">
              / {{ m.limit }} {{ m.unit }}
            </span>
          </template>
        </LStatistic>
        <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
          <div
            class="h-full rounded-full transition-all"
            :class="pct(m) > 80 ? 'bg-accent-warning' : 'bg-accent-primary'"
            :style="{ width: `${pct(m)}%` }"
          />
        </div>
        <div class="mt-1 text-[10px] text-fg-tertiary">
          {{ pct(m) }}% used
        </div>
      </LCard>
    </div>

    <LCard class="p-0">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 class="text-sm font-medium">Recent invoices</h3>
          <p class="text-xs text-fg-tertiary">
            Self-hosted installs don't generate invoices.
          </p>
        </div>
        <LButton quaternary size="sm">
          <FileText class="mr-1 h-3 w-3" />
          Export usage
        </LButton>
      </div>
      <div class="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-xs text-fg-tertiary">
        <TrendingUp class="h-6 w-6 text-fg-tertiary" />
        <p>No invoices to display — billing isn't enabled for self-hosted workspaces.</p>
      </div>
    </LCard>
  </div>
</template>