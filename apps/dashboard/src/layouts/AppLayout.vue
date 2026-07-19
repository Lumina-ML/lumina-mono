<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter, RouterView } from "vue-router";
import {
  Menu,
  Moon,
  Sun,
  Search,
  Pin,
  PinOff,
  ChevronLeft,
  KeyRound,
  LogOut,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
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
  LPopover,
  LAvatar,
  LDialog,
} from "@lumina/ui";
import { useThemeStore } from "@/stores/theme";
import { useSidebarStore } from "@/stores/sidebar";
import { useCommandStore } from "@/stores/command";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";
import { useNotificationsStore } from "@/stores/notifications";
import { useToast } from "@/composables/useToast";
import { ProjectService } from "@/services/project.service";
import { useGlobalRealtime } from "@/composables/useGlobalRealtime";
import { useQuery } from "@tanstack/vue-query";
import { WorkspaceService } from "@/services/workspace.service";
import NotificationBell from "@/components/Notifications/NotificationBell.vue";
import BrandMark from "@/components/BrandMark.vue";

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const sidebarStore = useSidebarStore();
const workspaceStore = useWorkspaceStore();
const commandStore = useCommandStore();
const authStore = useAuthStore();
const notifications = useNotificationsStore();
const toast = useToast();

const userMenuOpen = ref(false);
const copiedKey = ref(false);

// Rotate-key dialog: replacing the previous "toast only" flow that left
// users without a way to copy the freshly-issued key. Closes the §9 gap
// in `docs/User-Lifecycle-Flow-Audit.md`.
const rotatedKey = ref<string | null>(null);
const rotatedDialogOpen = ref(false);
const rotatedCopied = ref(false);
const rotating = ref(false);

// ── Workspace memberships (drives the workspace switcher in the sidebar)
// The query is reactive on auth.user.id so when a new user signs in the
// list refreshes. While the request is in flight the popover shows the
// previous data — better than a blank popover on every open.
const {
  data: memberships,
  refetch: refetchMemberships,
} = useQuery({
  queryKey: computed(() => ["workspace-memberships", "me", authStore.user?.id]),
  queryFn: () => {
    if (!authStore.user) return Promise.resolve([]);
    return WorkspaceService.listUserMemberships(authStore.user.id);
  },
  enabled: computed(() => !!authStore.user),
  staleTime: 60_000,
});

const workspaceOptions = computed(() => {
  const items = memberships.value ?? [];
  return items.map((m) => ({
    id: m.workspaceId,
    role: m.role,
    isCurrent: m.workspaceId === workspaceStore.currentId,
  }));
});

function selectWorkspace(id: string) {
  if (id === workspaceStore.currentId) return;
  workspaceStore.setCurrentId(id);
  toast.info(`Switched to workspace "${id}"`);
  // Force a refresh of project-scoped queries so the sidebar / project
  // lists reflect the new workspace without a hard reload.
  refetchMemberships();
}

const currentRole = computed(
  () => workspaceOptions.value.find((o) => o.isCurrent)?.role,
);

// Wire the global WebSocket → notifications pipeline for the lifetime
// of the app shell.
useGlobalRealtime();

const userInitial = computed(() => {
  const u = authStore.user;
  if (!u) return "U";
  const src = u.name?.trim() || u.email || "U";
  return src.charAt(0).toUpperCase();
});

async function onRotateKey() {
  userMenuOpen.value = false;
  rotating.value = true;
  try {
    const newKey = await authStore.rotateKey();
    if (newKey) {
      rotatedKey.value = newKey;
      rotatedDialogOpen.value = true;
      notifications.push({
        id: `api-key-rotated:${Date.now()}`,
        source: "ApiKeyRotated",
        level: "warning",
        title: "API key rotated",
        body: "Your old key is now invalid. Store the new key shown on screen.",
        link: "/settings/api-keys",
      });
      toast.info("API key rotated — copy the new one before closing.", {
        duration: 5000,
      });
    } else {
      toast.error(`Failed to rotate key: ${authStore.error ?? "unknown error"}`);
    }
  } finally {
    rotating.value = false;
  }
}

async function copyRotatedKey() {
  if (!rotatedKey.value) return;
  try {
    await navigator.clipboard.writeText(rotatedKey.value);
    rotatedCopied.value = true;
    setTimeout(() => (rotatedCopied.value = false), 1500);
  } catch {
    toast.error("Could not copy key to clipboard.");
  }
}

function dismissRotatedDialog() {
  rotatedKey.value = null;
  rotatedDialogOpen.value = false;
  rotatedCopied.value = false;
}

async function onCopyKey() {
  if (!authStore.apiKey) return;
  try {
    await navigator.clipboard.writeText(authStore.apiKey);
    copiedKey.value = true;
    setTimeout(() => (copiedKey.value = false), 1500);
  } catch {
    toast.error("Could not copy key to clipboard.");
  }
}

function onLogout() {
  authStore.logout();
  userMenuOpen.value = false;
  router.replace({ name: "Login" });
}

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
  } else if (name === "GlobalDatasets") {
    crumbs.push({ label: "Datasets" });
  } else if (name === "GlobalSweeps") {
    crumbs.push({ label: "Sweeps" });
  } else if (name === "GlobalReports") {
    crumbs.push({ label: "Reports" });
  } else if (name === "GlobalTraces") {
    crumbs.push({ label: "Traces" });
  } else if (name === "GlobalArtifacts") {
    crumbs.push({ label: "Artifacts" });
  } else if (name === "GlobalEvaluations") {
    crumbs.push({ label: "Evaluations" });
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

// ── Track recent projects for the sidebar ─────────────────────────────
// Whenever the user lands on a project page, push that project onto
// the sidebar's "recent projects" list. Errors are swallowed — a stale
// project name in the sidebar is harmless.
watch(
  () => route.params.projectId,
  async (id) => {
    if (typeof id !== "string") return;
    try {
      const p = await ProjectService.get(id);
      sidebarStore.touchProject({ id: p.id, name: p.name, description: p.description });
    } catch {
      /* ignore — sidebar recent-projects is best-effort */
    }
  },
  { immediate: true },
);
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

      <!-- Workspace footer -->
      <div
        class="border-t border-border p-3"
        :class="sidebarStore.collapsed ? 'flex justify-center' : ''"
      >
        <LPopover
          v-if="!sidebarStore.collapsed"
          placement="top-start"
          trigger="click"
        >
          <template #trigger>
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-canvas"
              :aria-label="`Workspace: ${workspaceStore.currentId}`"
            >
              <LAvatar
                :name="workspaceStore.currentId"
                size="xs"
                shape="square"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium text-fg-primary">
                  {{ workspaceStore.currentId }}
                </div>
                <div class="truncate text-[10px] text-fg-tertiary">
                  Workspace
                  <span v-if="currentRole" class="ml-1 text-fg-secondary">
                    · {{ currentRole }}
                  </span>
                </div>
              </div>
            </button>
          </template>
          <div class="w-60 space-y-1 p-1">
            <div class="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
              Workspaces
            </div>
            <div
              v-if="(workspaceOptions ?? []).length === 0"
              class="px-2 py-2 text-[11px] text-fg-tertiary"
            >
              You're only a member of the default workspace.
            </div>
            <button
              v-for="opt in workspaceOptions"
              :key="opt.id"
              type="button"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-canvas"
              :class="opt.isCurrent ? 'bg-canvas' : ''"
              @click="selectWorkspace(opt.id)"
            >
              <LAvatar :name="opt.id" size="xs" shape="square" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">{{ opt.id }}</div>
                <div class="truncate text-[10px] text-fg-tertiary">
                  role: {{ opt.role }}
                </div>
              </div>
              <span
                v-if="opt.isCurrent"
                class="font-mono text-[10px] text-accent-primary"
              >
                current
              </span>
            </button>
            <div
              v-if="(workspaceOptions ?? []).length > 1"
              class="border-t border-border pt-1"
            >
              <p class="px-2 py-1 text-[11px] text-fg-tertiary">
                Switching reloads the project + workspace-scoped queries.
              </p>
            </div>
          </div>
        </LPopover>
        <button
          v-else
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded text-fg-tertiary hover:bg-canvas"
          :aria-label="`Workspace: ${workspaceStore.currentId}`"
        >
          <LAvatar :name="workspaceStore.currentId" size="xs" shape="square" />
        </button>
      </div>
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
          <!-- Pinned -->
          <div v-if="sidebarStore.pinnedItems.length > 0" class="space-y-1">
            <div class="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
              Pinned
            </div>
            <LSidebarItem
              v-for="item in sidebarStore.pinnedItems"
              :key="`pin-${item.to}`"
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
          <div v-for="group in sidebarStore.displayGroups" :key="`m-${group.key}`" class="space-y-1">
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

          <NotificationBell />

          <LPopover
            v-model:show="userMenuOpen"
            placement="bottom-end"
            :padding="4"
            trigger="click"
          >
            <template #trigger>
              <button
                type="button"
                class="hidden h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-accent-primary/15 text-xs font-semibold text-accent-primary transition-colors hover:bg-accent-primary/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary md:flex"
                :aria-label="
                  authStore.user?.name
                    ? `Account menu for ${authStore.user.name}`
                    : 'Account menu'
                "
              >
                <img
                  v-if="authStore.user?.avatar"
                  :src="authStore.user.avatar"
                  alt=""
                  class="h-full w-full object-cover"
                />
                <span v-else>{{ userInitial }}</span>
              </button>
            </template>

            <div class="w-64 space-y-1">
              <div class="px-3 pb-2 pt-2">
                <div class="truncate text-sm font-medium">
                  {{ authStore.user?.name ?? "—" }}
                </div>
                <div class="truncate text-xs text-fg-tertiary">
                  {{ authStore.user?.email ?? "" }}
                </div>
              </div>

              <div class="border-t border-border" />

              <div class="px-2 py-1">
                <div class="mb-1 flex items-center justify-between px-1">
                  <span class="text-[10px] font-medium uppercase tracking-wider text-fg-tertiary">
                    API key
                  </span>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded px-1 text-[10px] text-fg-tertiary hover:text-fg-primary"
                    @click="onCopyKey"
                  >
                    <Check v-if="copiedKey" class="h-3 w-3 text-accent-success" />
                    <Copy v-else class="h-3 w-3" />
                    {{ copiedKey ? "Copied" : "Copy" }}
                  </button>
                </div>
                <code
                  class="block truncate rounded bg-canvas px-2 py-1 font-mono text-[11px] text-fg-secondary"
                  :title="authStore.apiKey ?? ''"
                >
                  {{ authStore.apiKey ?? "—" }}
                </code>
              </div>

              <div class="border-t border-border" />

              <button
                type="button"
                class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-canvas"
                @click="onRotateKey"
              >
                <RefreshCw class="h-3.5 w-3.5 text-fg-tertiary" />
                Rotate key
              </button>
              <RouterLink
                to="/settings/api-keys"
                class="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-canvas"
                @click="userMenuOpen = false"
              >
                <KeyRound class="h-3.5 w-3.5 text-fg-tertiary" />
                Manage keys
              </RouterLink>

              <div class="border-t border-border" />

              <button
                type="button"
                class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-accent-danger hover:bg-canvas"
                @click="onLogout"
              >
                <LogOut class="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </LPopover>
        </div>
      </header>

      <main class="flex-1 p-4 md:p-6">
        <RouterView />
      </main>
    </div>

    <!-- Rotate key confirmation dialog. Reuses the warning callout /
    copy button shape from SettingsApiKeys.vue so the UX is identical
    across both rotate entry points. -->
    <LDialog
      v-model:show="rotatedDialogOpen"
      title="Your new API key"
      width="520px"
      @close="dismissRotatedDialog"
    >
      <div class="space-y-3">
        <div
          class="flex items-start gap-2 rounded-md border border-accent-warning/30 bg-accent-warning/10 p-3 text-xs"
        >
          <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-warning" />
          <div>
            <div class="font-medium">Copy this key now — the old one is already invalid.</div>
            <div class="text-fg-tertiary">
              Any running SDK processes still using the old key will start
              receiving 401s on the next <code class="font-mono">log()</code> call.
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 rounded-md border border-border bg-canvas p-2 font-mono text-xs">
          <span class="min-w-0 flex-1 truncate">{{ rotatedKey }}</span>
          <LTooltip content="Copy">
            <LIconButton aria-label="Copy new API key" @click="copyRotatedKey">
              <Check v-if="rotatedCopied" class="h-3.5 w-3.5 text-accent-success" />
              <Copy v-else class="h-3.5 w-3.5" />
            </LIconButton>
          </LTooltip>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <LButton :loading="rotating" @click="dismissRotatedDialog">
            I've stored it
          </LButton>
        </div>
      </template>
    </LDialog>
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