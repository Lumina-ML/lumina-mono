import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  LayoutDashboard,
  FolderKanban,
  Box,
  Search,
  GitBranch,
  ClipboardCheck,
  Activity,
  FileText,
  Settings,
  Database,
  Rocket,
  Users,
  KeyRound,
} from "lucide-vue-next";
import type { Component } from "vue";

export interface NavItem {
  label: string;
  to: string;
  icon: Component;
  description?: string;
  external?: boolean;
}

export interface NavGroup {
  key: string;
  label?: string;
  items: NavItem[];
  pinFirst?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: "overview",
    items: [{ label: "Workspace Home", to: "/", icon: LayoutDashboard, description: "Overview & widgets" }],
  },
  {
    key: "experiments",
    label: "EXPERIMENTS",
    items: [
      { label: "Projects", to: "/projects", icon: FolderKanban, description: "All ML projects" },
    ],
  },
  {
    key: "models",
    label: "MODELS",
    items: [
      { label: "Model Registry", to: "/models", icon: GitBranch, description: "Registered models" },
      { label: "Datasets", to: "/datasets", icon: Database, description: "Dataset registry" },
    ],
  },
  {
    key: "insights",
    label: "INSIGHTS",
    items: [
      { label: "Reports", to: "/reports", icon: FileText, description: "Run reports" },
      { label: "Traces", to: "/traces", icon: Activity, description: "LLM & agent traces" },
      { label: "Monitoring", to: "/monitoring", icon: Search, description: "System metrics" },
    ],
  },
  {
    key: "execution",
    label: "EXECUTION",
    items: [
      { label: "Launch", to: "/launch", icon: Rocket, description: "Job queue" },
      { label: "Sweeps", to: "/sweeps", icon: ClipboardCheck, description: "Hyperparameter sweeps" },
      { label: "Artifacts", to: "/artifacts", icon: Box, description: "Artifact browser" },
      { label: "Evaluations", to: "/evaluations", icon: ClipboardCheck, description: "Evaluation runs" },
    ],
  },
  {
    key: "admin",
    label: "ADMIN",
    items: [
      { label: "Settings", to: "/settings", icon: Settings, description: "Workspace settings" },
      { label: "Members", to: "/settings/members", icon: Users, description: "Team members" },
      { label: "API Keys", to: "/settings/api-keys", icon: KeyRound, description: "Personal access tokens" },
    ],
  },
];

const PINNED_KEY = "lumina:sidebar:pinned";

function loadPinned(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINNED_KEY);
    if (!raw) return ["/", "/projects"];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export interface DynamicProject {
  id: string;
  name: string;
  description?: string | null;
}

export const useSidebarStore = defineStore("sidebar", () => {
  const collapsed = ref(false);
  const mobileOpen = ref(false);
  const pinned = ref<string[]>(loadPinned());

  // Recently visited projects — fed by the router watcher in AppLayout.
  // Capped to keep the sidebar compact.
  const recentProjects = ref<DynamicProject[]>([]);

  const navGroups = computed<NavGroup[]>(() => NAV_GROUPS);

  /**
   * Group rendered between "EXPERIMENTS" and "MODELS": the user's most
   * recently visited projects as quick links.
   */
  const projectGroup = computed<NavGroup | null>(() => {
    if (recentProjects.value.length === 0) return null;
    return {
      key: "recent-projects",
      label: "RECENT PROJECTS",
      items: recentProjects.value.slice(0, 5).map((p) => ({
        label: p.name,
        to: `/projects/${p.id}`,
        icon: FolderKanban,
        description: p.description ?? undefined,
      })),
    };
  });

  const pinnedItems = computed<NavItem[]>(() => {
    const allItems = NAV_GROUPS.flatMap((g) => g.items);
    return pinned.value
      .map((to) => allItems.find((i) => i.to === to))
      .filter((x): x is NavItem => Boolean(x));
  });

  const isPinned = (to: string): boolean => pinned.value.includes(to);

  // 折叠态没有 PINNED 区,显示全部(纯图标);展开态把已 pin 的项从分组里去掉,
  // 避免与顶部 PINNED 区重复渲染。空分组自动隐藏。
  const displayGroups = computed<NavGroup[]>(() => {
    const groups = [...NAV_GROUPS];
    if (projectGroup.value) {
      // Insert the dynamic project group right after "experiments".
      const idx = groups.findIndex((g) => g.key === "experiments");
      groups.splice(idx + 1, 0, projectGroup.value);
    }
    if (collapsed.value) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => !pinned.value.includes(i.to)),
      }))
      .filter((g) => g.items.length > 0);
  });

  function togglePin(to: string) {
    const idx = pinned.value.indexOf(to);
    if (idx >= 0) {
      pinned.value = pinned.value.filter((p) => p !== to);
    } else {
      pinned.value = [...pinned.value, to];
    }
    persist();
  }

  function persist() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PINNED_KEY, JSON.stringify(pinned.value));
    } catch {
      // ignore quota errors
    }
  }

  function toggle() {
    collapsed.value = !collapsed.value;
  }

  function setCollapsed(value: boolean) {
    collapsed.value = value;
  }

  function toggleMobile() {
    mobileOpen.value = !mobileOpen.value;
  }

  function setMobileOpen(value: boolean) {
    mobileOpen.value = value;
  }

  /**
   * Push a project onto the recent list. Most-recent first; deduplicated
   * by id; capped at 5 entries.
   */
  function touchProject(p: DynamicProject) {
    const next = [p, ...recentProjects.value.filter((x) => x.id !== p.id)].slice(0, 5);
    recentProjects.value = next;
  }

  return {
    collapsed,
    mobileOpen,
    pinned,
    navGroups,
    displayGroups,
    pinnedItems,
    isPinned,
    recentProjects,
    projectGroup,
    togglePin,
    toggle,
    setCollapsed,
    toggleMobile,
    setMobileOpen,
    touchProject,
  };
});
