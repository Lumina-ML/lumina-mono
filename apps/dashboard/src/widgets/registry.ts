import { registerWidgets } from "@lumina/ui";
import WorkspaceStatsWidget from "./workspace-stats/WorkspaceStatsWidget.vue";
import RecentRunsWidget from "./recent-runs/RecentRunsWidget.vue";
import QuickStartWidget from "./quick-start/QuickStartWidget.vue";
import MetricChartWidget from "./metric-chart-widget/MetricChartWidget.vue";

registerWidgets([
  {
    type: "workspace-stats",
    name: "Workspace Stats",
    description: "Overview statistics for the workspace",
    component: WorkspaceStatsWidget,
    defaultSize: { w: 12, h: 2 },
  },
  {
    type: "recent-runs",
    name: "Recent Runs",
    description: "List of recent experiment runs",
    component: RecentRunsWidget,
    defaultSize: { w: 6, h: 4 },
  },
  {
    type: "quick-start",
    name: "Quick Start",
    description: "SDK quick start guide",
    component: QuickStartWidget,
    defaultSize: { w: 6, h: 4 },
  },
  {
    type: "metric-chart",
    name: "Metric Chart",
    description: "Line chart for logged metrics",
    component: MetricChartWidget,
    defaultSize: { w: 12, h: 5 },
  },
]);
