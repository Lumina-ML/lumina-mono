<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterView } from "vue-router";
import {
  LayoutDashboard,
  FolderKanban,
  Box,
  Search,
  GitBranch,
  ClipboardCheck,
  FileText,
  Settings,
  Moon,
  Sun,
  Menu,
} from "lucide-vue-next";
import {
  LSidebar,
  LSidebarItem,
  LBreadcrumb,
  LBreadcrumbItem,
  LIconButton,
} from "@lumina/ui";
import { useThemeStore } from "@/stores/theme";
import { useSidebarStore } from "@/stores/sidebar";

const route = useRoute();
const themeStore = useThemeStore();
const sidebarStore = useSidebarStore();

const activeKey = computed(() => route.path);

const menuItems = [
  { label: "Overview", to: "/", icon: LayoutDashboard },
  { label: "Projects", to: "/projects", icon: FolderKanban },
  { label: "Artifacts", to: "/artifacts", icon: Box },
  { label: "Sweeps", to: "/sweeps", icon: Search },
  { label: "Model Registry", to: "/registry", icon: GitBranch },
  { label: "Evaluations", to: "/evaluations", icon: ClipboardCheck },
  { label: "Traces", to: "/traces", icon: Box },
  { label: "Reports", to: "/reports", icon: FileText },
  { label: "Settings", to: "/settings", icon: Settings },
];

const breadcrumbs = computed(() => {
  const crumbs: Array<{ label: string; to?: string }> = [{ label: "Lumina", to: "/" }];
  if (route.name === "ProjectList") {
    crumbs.push({ label: "Projects" });
  } else if (route.name === "ProjectDetail") {
    crumbs.push({ label: "Projects", to: "/projects" });
    crumbs.push({ label: route.params.projectId as string });
  } else if (route.name === "RunDetail") {
    crumbs.push({ label: "Runs" });
    crumbs.push({ label: route.params.runId as string });
  }
  return crumbs;
});
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <!-- Desktop sidebar -->
    <LSidebar :collapsed="sidebarStore.collapsed">
      <div class="flex h-14 items-center border-b border-border px-4">
        <span class="truncate text-lg font-semibold">Lumina</span>
      </div>
      <nav class="flex-1 space-y-1 overflow-auto p-3">
        <LSidebarItem
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          :active="activeKey === item.to"
        >
          <template #icon>
            <component :is="item.icon" class="h-4 w-4" />
          </template>
          {{ item.label }}
        </LSidebarItem>
      </nav>
    </LSidebar>

    <!-- Mobile drawer -->
    <Transition name="slide">
      <aside
        v-if="sidebarStore.mobileOpen"
        class="fixed left-0 top-0 z-50 flex h-screen w-56 flex-col border-r border-border bg-card md:hidden"
      >
        <div class="flex h-14 items-center justify-between border-b border-border px-4">
          <span class="text-lg font-semibold">Lumina</span>
          <LIconButton aria-label="Close menu" @click="sidebarStore.setMobileOpen(false)">
            <span class="text-lg leading-none">×</span>
          </LIconButton>
        </div>
        <nav class="flex-1 space-y-1 overflow-auto p-3">
          <LSidebarItem
            v-for="item in menuItems"
            :key="item.to"
            :to="item.to"
            :active="activeKey === item.to"
            @click="sidebarStore.setMobileOpen(false)"
          >
            <template #icon>
              <component :is="item.icon" class="h-4 w-4" />
            </template>
            {{ item.label }}
          </LSidebarItem>
        </nav>
      </aside>
    </Transition>

    <!-- Mobile backdrop -->
    <Transition name="fade">
      <div
        v-if="sidebarStore.mobileOpen"
        class="fixed inset-0 z-40 bg-black/50 md:hidden"
        @click="sidebarStore.setMobileOpen(false)"
      />
    </Transition>

    <!-- Main content -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div class="flex items-center gap-3">
          <LIconButton
            class="md:hidden"
            aria-label="Open menu"
            @click="sidebarStore.toggleMobile()"
          >
            <Menu class="h-5 w-5" />
          </LIconButton>
          <LBreadcrumb>
            <LBreadcrumbItem
              v-for="(crumb, index) in breadcrumbs"
              :key="index"
              :to="crumb.to"
            >
              {{ crumb.label }}
            </LBreadcrumbItem>
          </LBreadcrumb>
        </div>

        <LIconButton aria-label="Toggle theme" @click="themeStore.toggleDark()">
          <Moon v-if="themeStore.isDark" class="h-5 w-5" />
          <Sun v-else class="h-5 w-5" />
        </LIconButton>
      </header>

      <main class="flex-1 p-4 md:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 180ms ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
