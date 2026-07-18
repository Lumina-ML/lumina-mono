<script setup lang="ts">
import { computed, h } from "vue";
import { useRoute, RouterLink, RouterView } from "vue-router";
import type { MenuOption } from "naive-ui";
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NButton,
  NSpace,
  NBreadcrumb,
  NBreadcrumbItem,
} from "naive-ui";
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
import { useThemeStore } from "@/stores/theme";
import { useSidebarStore } from "@/stores/sidebar";


const route = useRoute();
const themeStore = useThemeStore();
const sidebarStore = useSidebarStore();

const activeKey = computed(() => route.path);

function menuItem(label: string, key: string, icon: typeof LayoutDashboard): MenuOption {
  return {
    key,
    icon: () => h(icon, { class: "w-4 h-4" }),
    label: () => h(RouterLink, { to: key, class: "flex items-center gap-2" }, () => label),
  };
}

const menuOptions: MenuOption[] = [
  menuItem("Overview", "/", LayoutDashboard),
  menuItem("Projects", "/projects", FolderKanban),
  menuItem("Artifacts", "/artifacts", Box),
  menuItem("Sweeps", "/sweeps", Search),
  menuItem("Model Registry", "/registry", GitBranch),
  menuItem("Evaluations", "/evaluations", ClipboardCheck),
  menuItem("Traces", "/traces", Box),
  menuItem("Reports", "/reports", FileText),
  menuItem("Settings", "/settings", Settings),
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
  <NLayout has-sider class="min-h-screen bg-background">
    <NLayoutSider
      :collapsed="sidebarStore.collapsed"
      :collapsed-width="64"
      :width="200"
      bordered
      class="bg-card"
    >
      <div class="h-14 flex items-center px-4 border-b border-border">
        <span v-if="!sidebarStore.collapsed" class="font-semibold text-lg">Lumina</span>
        <span v-else class="font-semibold text-lg">L</span>
      </div>
      <NMenu
        :value="activeKey"
        :collapsed="sidebarStore.collapsed"
        :collapsed-width="64"
        :options="menuOptions"
        class="pt-2"
      />
    </NLayoutSider>

    <NLayout>
      <NLayoutHeader bordered class="h-14 flex items-center justify-between px-4 bg-card">
        <NSpace align="center">
          <NButton text @click="sidebarStore.toggle()">
            <Menu class="w-5 h-5" />
          </NButton>
          <NBreadcrumb>
            <NBreadcrumbItem v-for="(crumb, index) in breadcrumbs" :key="index">
              <RouterLink v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</RouterLink>
              <span v-else>{{ crumb.label }}</span>
            </NBreadcrumbItem>
          </NBreadcrumb>
        </NSpace>

        <NButton text @click="themeStore.toggleDark()">
          <Moon v-if="themeStore.isDark" class="w-5 h-5" />
          <Sun v-else class="w-5 h-5" />
        </NButton>
      </NLayoutHeader>

      <NLayoutContent class="p-6 bg-background">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>
