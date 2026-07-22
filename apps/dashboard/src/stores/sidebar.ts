import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  LayoutDashboard,
  FolderKanban,
  Play,
  GitBranch,
  ClipboardCheck,
  Activity,
  FileText,
  Settings,
  Database,
  Rocket,
  Box,
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
}

/**
 * Workspace-level navigation. Items that previously lived here as
 * top-level links to global stub pages (Reports / Traces / Monitoring /
 * Launch / Sweeps / Artifacts / Evaluations) have been removed — those
 * concepts are project-scoped and reachable from the project tab bar.
 * The Settings entry is a single link; sub-pages (members, api-keys,
 * alerts) are navigated via the SettingsLayout's left rail. Billing was
 * removed in Phase 2 of the code-review fix plan.
 */
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
    key: "settings",
    items: [
      { label: "Settings", to: "/settings", icon: Settings, description: "Workspace settings" },
    ],
  },
];

/**
 * Build the project-scoped sidebar group for the currently active
 * project. Returned by the store as `currentProjectGroup` and rendered
 * inline when the route carries a `:projectId`. The label is rendered
 * as "PROJECT · <name>" by AppLayout to disambiguate from the static
 * workspace-level group labels.
 */
function projectNavGroup(projectId: string, _projectName: string): NavGroup {
  const base = `/projects/${projectId}`;
  return {
    key: "current-project",
    label: "PROJECT",
    items: [
      { label: "Overview", to: base, icon: LayoutDashboard },
      { label: "Runs", to: `${base}/runs`, icon: Play },
      { label: "Sweeps", to: `${base}/sweeps`, icon: ClipboardCheck },
      { label: "Artifacts", to: `${base}/artifacts`, icon: Box },
      { label: "Reports", to: `${base}/reports`, icon: FileText },
      { label: "Evaluations", to: `${base}/evaluations`, icon: Activity },
      { label: "Traces", to: `${base}/traces`, icon: Activity },
      { label: "Metrics", to: `${base}/metrics`, icon: Activity },
      { label: "Launch", to: `${base}/launch`, icon: Rocket },
      { label: "Settings", to: `${base}/settings`, icon: Settings },
    ],
  };
}

export interface DynamicProject {
  id: string;
  name: string;
  description?: string | null;
}

export const useSidebarStore = defineStore("sidebar", () => {
  const collapsed = ref(false);
  const mobileOpen = ref(false);

  // Recently visited projects — fed by the router watcher in AppLayout.
  // Capped to keep the sidebar compact.
  const recentProjects = ref<DynamicProject[]>([]);

  // The project currently active in the URL. Driven by AppLayout's route
  // watcher (same place that calls touchProject). Used to render a
  // project-scoped navigation block when the user is inside a project.
  const activeProjectId = ref<string | null>(null);
  const activeProjectName = ref<string | null>(null);

  const navGroups = computed<NavGroup[]>(() => NAV_GROUPS);

  /**
   * Group rendered between "EXPERIMENTS" and "MODELS": the user's most
   * recently visited projects as quick links. Hidden when inside a
   * project — the project context group replaces it (see below).
   */
  const projectGroup = computed<NavGroup | null>(() => {
    if (activeProjectId.value) return null;
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

  /**
   * Project-scoped navigation block, rendered when the user is inside a
   * project route. Replaces the workspace-level "RECENT PROJECTS" group
   * so the sidebar reflects the current context (Roadmap §MVP-1).
   */
  const currentProjectGroup = computed<NavGroup | null>(() => {
    if (!activeProjectId.value) return null;
    const name = activeProjectName.value ?? activeProjectId.value;
    return projectNavGroup(activeProjectId.value, name);
  });

  const displayGroups = computed<NavGroup[]>(() => {
    const groups = [...NAV_GROUPS];
    if (projectGroup.value) {
      // Insert the dynamic project group right after "experiments".
      const idx = groups.findIndex((g) => g.key === "experiments");
      groups.splice(idx + 1, 0, projectGroup.value);
    }
    if (currentProjectGroup.value) {
      // Project context replaces the recent-projects slot and sits
      // between "experiments" and "models".
      const idx = groups.findIndex((g) => g.key === "experiments");
      groups.splice(idx + 1, 0, currentProjectGroup.value);
    }
    return groups.filter((g) => g.items.length > 0);
  });

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

  /**
   * Mark which project the user is currently inside. Called from the
   * AppLayout route watcher whenever the URL matches `/projects/:id`.
   */
  function setActiveProject(id: string | null, name?: string | null) {
    activeProjectId.value = id;
    activeProjectName.value = name ?? null;
  }

  return {
    collapsed,
    mobileOpen,
    navGroups,
    displayGroups,
    recentProjects,
    projectGroup,
    currentProjectGroup,
    activeProjectId,
    activeProjectName,
    toggle,
    setCollapsed,
    toggleMobile,
    setMobileOpen,
    touchProject,
    setActiveProject,
  };
});