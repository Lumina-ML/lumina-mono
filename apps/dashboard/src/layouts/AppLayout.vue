<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterView } from "vue-router";
import {
  Menu,
  Moon,
  Sun,
  Search,
  Pin,
  PinOff,
  ChevronLeft,
} from "lucide-vue-next";
import {
  LSidebar,
  LSidebarItem,
  LBreadcrumb,
  LBreadcrumbItem,
  LIconButton,
  LTooltip,
  LButton,
  LTag,
} from "@lumina/ui";
import { useThemeStore } from "@/stores/theme";
import { useSidebarStore } from "@/stores/sidebar";
import { useCommandStore } from "@/stores/command";
import BrandMark from "@/components/BrandMark.vue";

const route = useRoute();
const themeStore = useThemeStore();
const sidebarStore = useSidebarStore();
const commandStore = useCommandStore();

const activeKey = computed(() => route.path);

const breadcrumbs = computed(() => {
  const crumbs: Array<{ label: string; to?: string }> = [{ label: "Lumina", to: "/" }];
  const name = route.name as string | undefined;
  const projectId = route.params.projectId as string | undefined;
  const runId = route.params.runId as string | undefined;
  const sweepId = route.params.sweepId as string | undefined;
  const artifactId = route.params.artifactId as string | undefined;
  const reportId = route.params.reportId as string | undefined;

  if (name === "ProjectList") {
    crumbs.push({ label: "Projects" });
  } else if (name === "RegistryList") {
    crumbs.push({ label: "Model Registry" });
  } else if (name === "ModelVersionDetail") {
    crumbs.push({ label: "Model Registry", to: "/models" });
    crumbs.push({
      label: `${route.params.name}@${route.params.version}`,
    });
  } else if (projectId) {
    // Any project-scoped page
    crumbs.push({ label: "Projects", to: "/projects" });
    crumbs.push({ label: projectId, to: `/projects/${projectId}` });
    if (name === "RunDetail" && runId) {
      crumbs.push({ label: "Runs", to: `/projects/${projectId}/runs` });
      crumbs.push({ label: runId });
    } else if (name === "SweepDetail" && sweepId) {
      crumbs.push({ label: "Sweeps", to: `/projects/${projectId}/sweeps` });
      crumbs.push({ label: sweepId });
    } else if (name === "ArtifactDetail" && artifactId) {
      crumbs.push({ label: "Artifacts", to: `/projects/${projectId}/artifacts` });
      crumbs.push({ label: artifactId });
    } else if (name === "ReportDetail" && reportId) {
      crumbs.push({ label: "Reports", to: `/projects/${projectId}/reports` });
      crumbs.push({ label: reportId });
    } else if (name === "ProjectRuns") {
      crumbs.push({ label: "Runs" });
    } else if (name === "ProjectSweeps") {
      crumbs.push({ label: "Sweeps" });
    } else if (name === "ProjectArtifacts") {
      crumbs.push({ label: "Artifacts" });
    } else if (name === "ProjectReports") {
      crumbs.push({ label: "Reports" });
    } else if (name === "ProjectLaunch") {
      crumbs.push({ label: "Launch" });
    } else if (name === "ProjectSettings") {
      crumbs.push({ label: "Settings" });
    }
  } else if (name === "RunDetailLegacy" && runId) {
    crumbs.push({ label: "Runs" });
    crumbs.push({ label: runId });
  }
  return crumbs;
});

function onItemClick() {
  if (sidebarStore.mobileOpen) sidebarStore.setMobileOpen(false);
}
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <!-- Desktop sidebar -->
    <LSidebar :collapsed="sidebarStore.collapsed">
      <div class="flex h-12 items-center justify-between border-b border-border px-4">
        <RouterLink to="/" class="flex min-w-0 items-center gap-2">
          <BrandMark
            :size="sidebarStore.collapsed ? 24 : 28"
            :show-wordmark="!sidebarStore.collapsed"
          />
        </RouterLink>
        <LIconButton
          v-if="!sidebarStore.collapsed"
          aria-label="Collapse sidebar"
          class="hidden md:inline-flex"
          @click="sidebarStore.toggle()"
        >
          <ChevronLeft class="h-4 w-4" />
        </LIconButton>
      </div>

      <nav class="flex-1 space-y-2 overflow-auto p-2">
        <!-- Pinned -->
        <div v-if="sidebarStore.pinnedItems.length > 0 && !sidebarStore.collapsed">
          <div class="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
            Pinned
          </div>
          <div class="space-y-1">
            <div
              v-for="item in sidebarStore.pinnedItems"
              :key="`pin-${item.to}`"
              class="group relative"
            >
              <LSidebarItem
                :to="item.to"
                :active="activeKey === item.to"
                @click="onItemClick"
              >
                <template #icon>
                  <component :is="item.icon" class="h-4 w-4" />
                </template>
                {{ item.label }}
              </LSidebarItem>
              <LTooltip :content="'Unpin'" placement="right">
                <LIconButton
                  aria-label="Unpin"
                  class="absolute right-2 top-1/2 hidden -translate-y-1/2 group-hover:inline-flex"
                  @click="sidebarStore.togglePin(item.to)"
                >
                  <PinOff class="h-3 w-3" />
                </LIconButton>
              </LTooltip>
            </div>
          </div>
        </div>

        <!-- Groups -->
        <div v-for="group in sidebarStore.displayGroups" :key="group.key" class="space-y-1">
          <div
            v-if="group.label && !sidebarStore.collapsed"
            class="px-2 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-tertiary"
          >
            {{ group.label }}
          </div>
          <div
            v-for="item in group.items"
            :key="item.to"
            class="group relative"
          >
            <LSidebarItem
              :to="item.to"
              :active="activeKey === item.to"
              @click="onItemClick"
            >
              <template #icon>
                <component :is="item.icon" class="h-4 w-4" />
              </template>
              <span v-if="!sidebarStore.collapsed">{{ item.label }}</span>
            </LSidebarItem>
            <LTooltip
              v-if="!sidebarStore.collapsed"
              :content="sidebarStore.isPinned(item.to) ? 'Unpin' : 'Pin to top'"
              placement="right"
            >
              <LIconButton
                aria-label="Toggle pin"
                :class="[
                  'absolute right-2 top-1/2 hidden -translate-y-1/2 group-hover:inline-flex',
                  sidebarStore.isPinned(item.to) ? 'inline-flex text-accent-primary' : '',
                ]"
                @click="sidebarStore.togglePin(item.to)"
              >
                <Pin class="h-3 w-3" />
              </LIconButton>
            </LTooltip>
          </div>
        </div>
      </nav>
    </LSidebar>

    <!-- Mobile drawer -->
    <Transition name="slide">
      <aside
        v-if="sidebarStore.mobileOpen"
        class="fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-border bg-card md:hidden"
      >
        <div class="flex h-14 items-center justify-between border-b border-border px-4">
          <BrandMark :size="28" :show-wordmark="true" />
          <LIconButton aria-label="Close menu" @click="sidebarStore.setMobileOpen(false)">
            <span class="text-lg leading-none">×</span>
          </LIconButton>
        </div>
        <nav class="flex-1 space-y-3 overflow-auto p-3">
          <div v-for="group in sidebarStore.navGroups" :key="group.key" class="space-y-1">
            <div
              v-if="group.label"
              class="px-2 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-tertiary"
            >
              {{ group.label }}
            </div>
            <LSidebarItem
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              :active="activeKey === item.to"
              @click="onItemClick"
            >
              <template #icon>
                <component :is="item.icon" class="h-4 w-4" />
              </template>
              {{ item.label }}
            </LSidebarItem>
          </div>
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
      <header
        class="flex h-12 items-center justify-between gap-3 border-b border-border bg-card px-4"
      >
        <div class="flex min-w-0 items-center gap-3">
          <LIconButton
            class="md:hidden"
            aria-label="Open menu"
            @click="sidebarStore.toggleMobile()"
          >
            <Menu class="h-5 w-5" />
          </LIconButton>
          <LIconButton
            v-if="sidebarStore.collapsed"
            class="hidden md:inline-flex"
            aria-label="Expand sidebar"
            @click="sidebarStore.toggle()"
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

        <div class="flex flex-shrink-0 items-center gap-2">
          <!-- ⌘K trigger -->
          <LButton
            quaternary
            size="sm"
            class="!flex !items-center !gap-2"
            @click="commandStore.show()"
          >
            <Search class="h-4 w-4" />
            <span class="hidden text-fg-tertiary sm:inline">Search…</span>
            <LTag
              size="small"
              type="default"
              class="ml-2 hidden font-mono !text-[10px] sm:inline-flex"
            >
              {{ commandStore.shortcutLabel }}
            </LTag>
          </LButton>

          <LIconButton aria-label="Toggle theme" @click="themeStore.toggleDark()">
            <Moon v-if="themeStore.isDark" class="h-5 w-5" />
            <Sun v-else class="h-5 w-5" />
          </LIconButton>

          <div
            class="hidden h-8 w-8 items-center justify-center rounded-full bg-accent-primary/15 text-xs font-semibold text-accent-primary md:flex"
            aria-label="User avatar"
          >
            U
          </div>
        </div>
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