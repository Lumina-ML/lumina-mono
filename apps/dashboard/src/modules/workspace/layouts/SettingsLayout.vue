<script setup lang="ts">
import { useRoute, RouterView, RouterLink } from "vue-router";
import { Users, Key, CreditCard, Settings as SettingsIcon } from "lucide-vue-next";

const route = useRoute();

interface SettingsTab {
  key: string;
  label: string;
  to: string;
  icon: typeof Users;
}

const tabs: SettingsTab[] = [
  { key: "general", label: "General", to: "/settings", icon: SettingsIcon },
  { key: "members", label: "Members", to: "/settings/members", icon: Users },
  { key: "api-keys", label: "API keys", to: "/settings/api-keys", icon: Key },
  { key: "billing", label: "Billing", to: "/settings/billing", icon: CreditCard },
];

function isActive(tab: SettingsTab): boolean {
  return route.path === tab.to;
}
</script>

<template>
  <div class="flex h-full min-h-0 gap-6">
    <!-- Left rail -->
    <aside class="hidden w-44 flex-shrink-0 md:block">
      <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
        Workspace Settings
      </h2>
      <nav class="space-y-1">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.key"
          :to="tab.to"
          :class="[
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
            isActive(tab)
              ? 'bg-accent-primary/10 font-medium text-accent-primary'
              : 'text-fg-secondary hover:bg-canvas hover:text-fg-primary',
          ]"
        >
          <component :is="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </RouterLink>
      </nav>
    </aside>

    <!-- Right content -->
    <div class="min-w-0 flex-1 space-y-4">
      <RouterView />
    </div>
  </div>
</template>