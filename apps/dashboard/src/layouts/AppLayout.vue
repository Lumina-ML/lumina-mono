<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter, RouterView } from "vue-router";
import {
  Menu,
  Moon,
  Sun,
  Search,
  ChevronLeft,
  KeyRound,
  LogOut,
  RefreshCw,
  Copy,
  Check,
} from "lucide-vue-next";
import {
  LSidebar,
  LSidebarItem,
  LBreadcrumb,
  LBreadcrumbItem,
  LIconButton,
  LButton,
  LTag,
  LPopover,
  LAvatar,
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
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { WorkspaceService } from "@/services/workspace.service";
import NotificationBell from "@/components/Notifications/NotificationBell.vue";
import BrandMark from "@/components/BrandMark.vue";
import ApiKeyDialog from "@/modules/workspace/components/ApiKeyDialog.vue";

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const sidebarStore = useSidebarStore();
const workspaceStore = useWorkspaceStore();
const commandStore = useCommandStore();
const authStore = useAuthStore();
const notifications = useNotificationsStore();
const toast = useToast();
const queryClient = useQueryClient();

const userMenuOpen = ref(false);
const copiedKey = ref(false);

// Rotate-key dialog: replacing the previous "toast only" flow that left
// users without a way to copy the freshly-issued key. Closes the §9 gap
// in `docs/User-Lifecycle-Flow-Audit.md`.
const rotatedKey = ref<string | null>(null);
const rotatedDialogOpen = ref(false);
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

// Keep the persisted selection valid for this user: if the stored workspace
// isn't one they belong to (fresh user whose default ≠ "default", or a
// revoked membership), snap to their first available workspace. This keeps
// the `X-Lumina-Workspace` header we send acceptable to the server.
watch(
  memberships,
  (list) => {
    const ids = (list ?? []).map((m) => m.workspaceId);
    workspaceStore.syncToMemberships(ids);
  },
  { immediate: true },
);

function selectWorkspace(id: string) {
  if (id === workspaceStore.currentId) return;
  workspaceStore.setCurrentId(id);
  toast.info(`Switched to workspace "${id}"`);
  // Every workspace-scoped query is now stale — drop them all so lists,
  // details, and the sidebar refetch under the new workspace. Identity
  // queries (memberships / me) are sent with skipWorkspace so they're
  // unaffected and keep the switcher populated.
  void queryClient.invalidateQueries();
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

async function dismissRotatedDialog() {
  rotatedKey.value = null;
  rotatedDialogOpen.value = false;
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

/**
 * Resolve whether a sidebar entry should be in its "active" state.
 *
 * Replaces the previous `route.path === item.to` strict equality that
 * broke highlighting on nested routes (Roadmap §1.1 bug #1):
 *   - `/` only matches `/` exactly (everything starts with `/`).
 *   - Other entries match their own path *and* any descendant path
 *     so `/projects` highlights when on `/projects/abc/runs/xyz`.
 *
 * Keeping this as a function (instead of an inline expression) is what
 * lets the desktop sidebar and mobile drawer share the rule from one
 * place — bug #6 fix.
 */
function isItemActive(to: string): boolean {
  if (to === "/") return route.path === "/";
  return route.path === to || route.path.startsWith(to + "/");
}

function isCurrentProjectGroup(groupKey: string): boolean {
  return groupKey === "current-project";
}

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
// the sidebar's "recent projects" list and mark it as the active
// project context so the sidebar can render a project-scoped nav block.
// Errors are swallowed — a stale project name in the sidebar is harmless.
watch(
  () => route.params.projectId,
  async (id) => {
    if (typeof id !== "string") {
      sidebarStore.setActiveProject(null);
      return;
    }
    try {
      const p = await ProjectService.get(id);
      sidebarStore.touchProject({ id: p.id, name: p.name, description: p.description });
      sidebarStore.setActiveProject(p.id, p.name);
    } catch {
      /* ignore — sidebar recent-projects is best-effort */
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <!-- Desktop sidebar. LSidebar is internally a `h-screen flex-col`
         with an `overflow-auto` nav, so it scrolls independently of
         the main content (which lives in a separate `overflow-y-auto`
         column below). This keeps the sidebar header pinned while the
         page scrolls. -->
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
        <!-- Groups -->
        <div v-for="group in sidebarStore.displayGroups" :key="group.key" class="space-y-1">
          <div
            v-if="group.label && !sidebarStore.collapsed"
            class="px-2 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-tertiary"
          >
            <template v-if="isCurrentProjectGroup(group.key) && sidebarStore.activeProjectName">
              {{ group.label }} · {{ sidebarStore.activeProjectName }}
            </template>
            <template v-else>{{ group.label }}</template>
          </div>
          <div
            v-for="item in group.items"
            :key="item.to"
            class="group relative"
          >
            <LSidebarItem
              :to="item.to"
              :active="isItemActive(item.to)"
              @click="onItemClick"
            >
              <template #icon>
                <component :is="item.icon" class="h-4 w-4" />
              </template>
              <span v-if="!sidebarStore.collapsed">{{ item.label }}</span>
            </LSidebarItem>
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
            <LButton
              quaternary
              size="sm"
              class="!justify-start w-full !px-2 !py-1.5 !text-xs"
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
            </LButton>
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
            <LButton
              v-for="opt in workspaceOptions"
              :key="opt.id"
              quaternary
              size="sm"
              class="!justify-start w-full !px-2 !py-1.5 !text-sm"
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
            </LButton>
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
        <LIconButton
          v-else
          :aria-label="`Workspace: ${workspaceStore.currentId}`"
        >
          <LAvatar :name="workspaceStore.currentId" size="xs" shape="square" />
        </LIconButton>
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
          <div v-for="group in sidebarStore.displayGroups" :key="`m-${group.key}`" class="space-y-1">
            <div
              v-if="group.label"
              class="px-2 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-tertiary"
            >
              <template v-if="isCurrentProjectGroup(group.key) && sidebarStore.activeProjectName">
                {{ group.label }} · {{ sidebarStore.activeProjectName }}
              </template>
              <template v-else>{{ group.label }}</template>
            </div>
            <LSidebarItem
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              :active="isItemActive(item.to)"
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
              <LIconButton
                class="!hidden md:!flex !h-8 !w-8 !rounded-full !bg-accent-primary/15 hover:!bg-accent-primary/25 !text-accent-primary !text-xs !font-semibold"
                :aria-label="
                  authStore.user?.name
                    ? `Account menu for ${authStore.user.name}`
                    : 'Account menu'
                "
              >
                <LAvatar
                  v-if="authStore.user?.avatar"
                  :src="authStore.user.avatar"
                  :alt="authStore.user?.name ?? ''"
                  size="xs"
                  shape="circle"
                  class="!h-full !w-full"
                />
                <span v-else>{{ userInitial }}</span>
              </LIconButton>
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
                  <LButton
                    quaternary
                    size="xs"
                    class="!text-[10px]"
                    @click="onCopyKey"
                  >
                    <Check v-if="copiedKey" class="mr-1 h-3 w-3 text-accent-success" />
                    <Copy v-else class="mr-1 h-3 w-3" />
                    {{ copiedKey ? "Copied" : "Copy" }}
                  </LButton>
                </div>
                <code
                  class="block truncate rounded bg-canvas px-2 py-1 font-mono text-[11px] text-fg-secondary"
                  :title="authStore.apiKey ?? ''"
                >
                  {{ authStore.apiKey ?? "—" }}
                </code>
              </div>

              <div class="border-t border-border" />

              <LButton
                quaternary
                size="sm"
                class="!justify-start w-full !text-sm !px-3 !py-2"
                @click="onRotateKey"
              >
                <RefreshCw class="mr-2 h-3.5 w-3.5 text-fg-tertiary" />
                Rotate key
              </LButton>
              <RouterLink
                to="/settings/api-keys"
                class="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-canvas"
                @click="userMenuOpen = false"
              >
                <KeyRound class="h-3.5 w-3.5 text-fg-tertiary" />
                Manage keys
              </RouterLink>

              <div class="border-t border-border" />

              <LButton
                quaternary
                size="sm"
                class="!justify-start w-full !text-sm !px-3 !py-2 !text-accent-danger"
                @click="onLogout"
              >
                <LogOut class="mr-2 h-3.5 w-3.5" />
                Sign out
              </LButton>
            </div>
          </LPopover>
        </div>
      </header>

      <a
        href="#main-content"
        class="sr-only absolute left-2 top-2 z-50 rounded bg-accent-primary px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <main id="main-content" class="flex-1 overflow-y-auto p-4 md:p-6" tabindex="-1">
        <RouterView />
      </main>
    </div>

    <!-- Rotate key confirmation dialog. Reuses the warning callout /
    copy button shape from SettingsApiKeys.vue so the UX is identical
    across both rotate entry points. -->
    <ApiKeyDialog
      v-model:open="rotatedDialogOpen"
      :api-key="rotatedKey"
      warning-title="Copy this key now — the old one is already invalid."
      warning-detail="Any running SDK processes still using the old key will start receiving 401s on the next log() call."
      @update:open="dismissRotatedDialog"
    />
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