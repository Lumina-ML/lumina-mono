import type { Component } from "vue";
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
  Plus,
  Moon,
  Sun,
  RefreshCw,
  Sparkles,
} from "lucide-vue-next";
import { router } from "@/app/router";

export type CommandGroup = "Recent" | "Pages" | "Actions" | "Settings";

export interface CommandItem {
  id: string;
  group: CommandGroup;
  title: string;
  description?: string;
  keywords?: string[];
  shortcut?: string[];
  icon?: Component;
  perform: () => void | Promise<void>;
  visibility?: () => boolean;
}

const NAV_DEFS: Array<{
  label: string;
  to: string;
  icon: Component;
  description: string;
  keywords?: string[];
}> = [
  { label: "Workspace Home", to: "/", icon: LayoutDashboard, description: "Overview & widgets", keywords: ["home", "overview", "dashboard"] },
  { label: "Projects", to: "/projects", icon: FolderKanban, description: "All ML projects", keywords: ["project", "workspace"] },
  { label: "Model Registry", to: "/models", icon: GitBranch, description: "Registered models", keywords: ["model", "registry", "version"] },
  { label: "Datasets", to: "/datasets", icon: Database, description: "Dataset registry", keywords: ["dataset", "data"] },
  { label: "Reports", to: "/reports", icon: FileText, description: "Run reports", keywords: ["report", "doc"] },
  { label: "Traces", to: "/traces", icon: Activity, description: "LLM & agent traces", keywords: ["trace", "llm", "span"] },
  { label: "Monitoring", to: "/monitoring", icon: Search, description: "System metrics", keywords: ["monitor", "metrics", "system"] },
  { label: "Launch", to: "/launch", icon: Rocket, description: "Job queue", keywords: ["launch", "queue", "job"] },
  { label: "Sweeps", to: "/sweeps", icon: ClipboardCheck, description: "Hyperparameter sweeps", keywords: ["sweep", "hpo", "tune"] },
  { label: "Artifacts", to: "/artifacts", icon: Box, description: "Artifact browser", keywords: ["artifact", "file"] },
  { label: "Evaluations", to: "/evaluations", icon: ClipboardCheck, description: "Evaluation runs", keywords: ["eval", "judge"] },
  { label: "Settings", to: "/settings", icon: Settings, description: "Workspace settings", keywords: ["settings", "config"] },
  { label: "Members", to: "/settings/members", icon: Users, description: "Team members", keywords: ["members", "team", "user"] },
  { label: "API Keys", to: "/settings/api-keys", icon: KeyRound, description: "Personal access tokens", keywords: ["api", "key", "token"] },
];

interface CommandPaletteState {
  toggleTheme: () => void;
  isDark: () => boolean;
}

let paletteState: CommandPaletteState | null = null;

export function bindCommandPaletteState(state: CommandPaletteState) {
  paletteState = state;
}

function navigate(to: string) {
  void router.push(to);
}

export function getAllCommands(): CommandItem[] {
  const cmds: CommandItem[] = [];

  for (const nav of NAV_DEFS) {
    cmds.push({
      id: `nav:${nav.to}`,
      group: "Pages",
      title: nav.label,
      description: nav.description,
      keywords: nav.keywords,
      icon: nav.icon,
      perform: () => navigate(nav.to),
    });
  }

  cmds.push({
    id: "action:new-project",
    group: "Actions",
    title: "New Project",
    description: "Create a new ML project",
    keywords: ["create", "new", "project"],
    shortcut: ["N", "P"],
    icon: Plus,
    perform: () => navigate("/projects?new=1"),
  });

  cmds.push({
    id: "action:new-report",
    group: "Actions",
    title: "New Report",
    description: "Create a run report",
    keywords: ["create", "report"],
    shortcut: ["N", "R"],
    icon: Sparkles,
    perform: () => navigate("/reports?new=1"),
  });

  cmds.push({
    id: "action:reload",
    group: "Actions",
    title: "Reload Page",
    description: "Refresh the current view",
    keywords: ["refresh", "reload"],
    shortcut: ["R"],
    icon: RefreshCw,
    perform: () => {
      if (typeof window !== "undefined") window.location.reload();
    },
  });

  cmds.push({
    id: "settings:toggle-theme",
    group: "Settings",
    title: "Toggle Theme",
    description: "Switch between light and dark mode",
    keywords: ["theme", "dark", "light", "mode"],
    shortcut: ["T"],
    icon: paletteState?.isDark() ? Sun : Moon,
    perform: () => paletteState?.toggleTheme(),
  });

  return cmds;
}

export function getRecentCommands(): CommandItem[] {
  if (typeof window === "undefined") return [];
  const KEY = "lumina:cmdk:recent";
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids = parsed.filter((x): x is string => typeof x === "string");
    const all = getAllCommands();
    return ids
      .map((id) => all.find((c) => c.id === id))
      .filter((x): x is CommandItem => Boolean(x));
  } catch {
    return [];
  }
}

export function recordCommandUsage(id: string, limit = 5) {
  if (typeof window === "undefined") return;
  const KEY = "lumina:cmdk:recent";
  try {
    const raw = window.localStorage.getItem(KEY);
    const prev: string[] = raw ? (JSON.parse(raw) as string[]).filter((x) => typeof x === "string") : [];
    const next = [id, ...prev.filter((p) => p !== id)].slice(0, limit);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// Re-export nav defs so other modules (e.g. sidebar) can stay in sync.
export { NAV_DEFS };