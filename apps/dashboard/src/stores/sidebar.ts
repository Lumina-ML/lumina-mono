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

export const useSidebarStore = defineStore("sidebar", () => {
  const collapsed = ref(false);
  const mobileOpen = ref(false);
  const pinned = ref<string[]>(loadPinned());

  const navGroups = computed<NavGroup[]>(() => NAV_GROUPS);

  const pinnedItems = computed<NavItem[]>(() => {
    const allItems = NAV_GROUPS.flatMap((g) => g.items);
    return pinned.value
      .map((to) => allItems.find((i) => i.to === to))
      .filter((x): x is NavItem => Boolean(x));
  });

  const isPinned = (to: string): boolean => pinned.value.includes(to);

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

  return {
    collapsed,
    mobileOpen,
    pinned,
    navGroups,
    pinnedItems,
    isPinned,
    togglePin,
    toggle,
    setCollapsed,
    toggleMobile,
    setMobileOpen,
  };
});