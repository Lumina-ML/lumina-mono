<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  GridStackLayout,
  WidgetRenderer,
  LButton,
  LCard,
} from "@lumina/ui";
import type { DashboardLayout, LayoutItem } from "@lumina/ui";
import {
  Play,
  ClipboardCheck,
  Activity,
  Box,
  FileText,
  Sparkles,
  RotateCcw,
  Rocket,
  Wand2,
} from "lucide-vue-next";
import {
  SandboxService,
  type DemoScenario,
  type DemoRunResult,
} from "@/services/sandbox.service";
import { ProjectService } from "@/services/project.service";
import { useToast } from "@/composables/useToast";

const STORAGE_KEY = "lumina:workspace-layout";

const defaultLayout: DashboardLayout = {
  columns: 12,
  rowHeight: 80,
  gap: 16,
  widgets: [
    { id: "stats", type: "workspace-stats", x: 0, y: 0, w: 12, h: 2 },
    { id: "recent-runs", type: "recent-runs", x: 0, y: 2, w: 6, h: 4 },
    { id: "quick-start", type: "quick-start", x: 6, y: 2, w: 6, h: 4 },
  ],
};

function loadLayout(): LayoutItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as LayoutItem[];
    }
  } catch {
    // ignore corrupt storage
  }
  return defaultLayout.widgets;
}

const layout = ref<LayoutItem[]>(loadLayout());
const editable = ref(false);

watch(
  layout,
  (newLayout) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
  },
  { deep: true },
);

function resetLayout() {
  layout.value = defaultLayout.widgets.map((item) => ({ ...item }));
}

// ── Demo cards (Roadmap §MVP-2) ───────────────────────────────────────
// Each card runs a pre-built scenario in the `__demo__` project and
// navigates the user straight to the resulting detail page. Cards are
// the centerpiece of the workspace overview — without them the page
// shows an empty widgets grid, which is the "white wall" problem
// called out in Roadmap §1.3.
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();

interface DemoCard {
  scenario: DemoScenario;
  title: string;
  description: string;
  icon: typeof Rocket;
  targetKind: DemoRunResult["targetKind"];
}

const cards: DemoCard[] = [
  {
    scenario: "basic",
    title: "Basic experiment",
    description: "3 runs with loss/accuracy curves over 30 steps.",
    icon: Play,
    targetKind: "run",
  },
  {
    scenario: "sweep",
    title: "Hyperparameter sweep",
    description: "1 sweep + 4 trial runs, randomized LR search.",
    icon: ClipboardCheck,
    targetKind: "sweep",
  },
  {
    scenario: "evaluation",
    title: "Model evaluation",
    description: "Linked dataset + model artifacts, 5 evaluation metrics.",
    icon: FileText,
    targetKind: "evaluation",
  },
  {
    scenario: "trace",
    title: "LLM trace",
    description: "Agent trace with 5 spans (retriever, llm, tool, …).",
    icon: Activity,
    targetKind: "trace",
  },
  {
    scenario: "artifacts",
    title: "Artifact versions",
    description: "1 model artifact with 2 versions and 2 files.",
    icon: Box,
    targetKind: "artifact",
  },
];

const runningScenario = ref<DemoScenario | null>(null);
const disabled = computed(() => runningScenario.value !== null);

const runMutation = useMutation({
  mutationFn: (scenario: DemoScenario) => SandboxService.runExample(scenario),
  onSuccess: (result) => {
    runningScenario.value = null;
    toast.success(result.summary);
    // Drop any cached lists so the destination page shows fresh data.
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["runs"] });
    queryClient.invalidateQueries({ queryKey: ["sweeps"] });
    queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    queryClient.invalidateQueries({ queryKey: ["traces"] });
    queryClient.invalidateQueries({ queryKey: ["artifacts"] });
    router.push(routeFor(result));
  },
  onError: (e) => {
    runningScenario.value = null;
    toast.error(`Demo failed: ${(e as Error).message}`);
  },
});

function routeFor(result: DemoRunResult): { name: string; params: Record<string, string> } {
  const { projectId, targetId, targetKind } = result;
  switch (targetKind) {
    case "run":
      return { name: "RunDetail", params: { projectId, runId: targetId } };
    case "sweep":
      return { name: "SweepDetail", params: { projectId, sweepId: targetId } };
    case "evaluation":
      return {
        name: "EvaluationDetail",
        params: { projectId, evaluationId: targetId },
      };
    case "trace":
      return { name: "TraceDetail", params: { projectId, traceId: targetId } };
    case "artifact":
      return {
        name: "ArtifactDetail",
        params: { projectId, artifactId: targetId },
      };
  }
}

function runDemo(scenario: DemoScenario) {
  runningScenario.value = scenario;
  runMutation.mutate(scenario);
}

const resetMutation = useMutation({
  mutationFn: async () => {
    const projects = await ProjectService.list({ limit: 100, offset: 0 });
    const demo = projects.items.find((p) => p.name === "__demo__");
    if (!demo) throw new Error("Demo project not found — has the seed run?");
    return SandboxService.resetDemo(demo.id);
  },
  onSuccess: (result) => {
    toast.success(
      `Demo data reset (${result.deleted.runs} runs, ${result.deleted.artifacts} artifacts cleared).`,
    );
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["runs"] });
    queryClient.invalidateQueries({ queryKey: ["sweeps"] });
    queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    queryClient.invalidateQueries({ queryKey: ["traces"] });
    queryClient.invalidateQueries({ queryKey: ["artifacts"] });
  },
  onError: (e) => toast.error(`Reset failed: ${(e as Error).message}`),
});
</script>

<template>
  <div class="space-y-8">
    <!-- Hero -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Workspace Overview</h1>
        <p class="text-muted-foreground">
          Welcome to Lumina — your self-hosted AI/ML control plane.
        </p>
      </div>
    </div>

    <!-- Demo cards: the show-floor centerpiece (Roadmap §MVP-2). -->
    <section class="space-y-3">
      <header class="flex items-end justify-between">
        <div>
          <h2 class="flex items-center gap-2 text-lg font-semibold">
            <Wand2 class="h-4 w-4 text-accent-primary" />
            Try a demo
          </h2>
          <p class="text-sm text-fg-tertiary">
            Click any card to populate the playground project with realistic
            data — then jump straight to the resulting detail page.
          </p>
        </div>
        <LButton
          size="sm"
          quaternary
          :loading="resetMutation.isPending.value"
          @click="resetMutation.mutate()"
        >
          <RotateCcw class="mr-1 h-3 w-3" />
          Reset demo data
        </LButton>
      </header>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        <LCard
          v-for="card in cards"
          :key="card.scenario"
          class="group flex h-full flex-col p-4 transition-colors hover:border-accent-primary/50"
        >
          <div class="mb-2 flex items-center gap-2">
            <component
              :is="card.icon"
              class="h-4 w-4 text-accent-primary"
            />
            <h3 class="text-sm font-medium">{{ card.title }}</h3>
          </div>
          <p class="mb-4 flex-1 text-xs text-fg-tertiary">
            {{ card.description }}
          </p>
          <LButton
            size="sm"
            :disabled="disabled"
            :loading="runningScenario === card.scenario"
            class="w-full"
            @click="runDemo(card.scenario)"
          >
            <Sparkles v-if="runningScenario !== card.scenario" class="mr-1 h-3 w-3" />
            Try it
          </LButton>
        </LCard>
      </div>
    </section>

    <!-- Layout-driven widgets: stats, recent runs, quick start, … -->
    <section class="space-y-3">
      <header class="flex items-end justify-between">
        <div>
          <h2 class="text-lg font-semibold">Dashboard</h2>
          <p class="text-sm text-fg-tertiary">
            Drag to rearrange. Layout is saved per browser.
          </p>
        </div>
        <div class="flex gap-2">
          <LButton size="sm" @click="editable = !editable">
            {{ editable ? "Done" : "Edit Layout" }}
          </LButton>
          <LButton v-if="editable" size="sm" text @click="resetLayout">
            Reset
          </LButton>
        </div>
      </header>

      <GridStackLayout
        v-model:layout="layout"
        :columns="defaultLayout.columns"
        :row-height="defaultLayout.rowHeight"
        :gap="defaultLayout.gap"
        :editable="editable"
      >
        <template #default="{ item }">
          <WidgetRenderer :item="item" :editable="editable" />
        </template>
      </GridStackLayout>
    </section>
  </div>
</template>