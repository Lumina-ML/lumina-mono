import { createRouter, createWebHistory } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: AppLayout,
      children: [
        {
          path: "",
          name: "WorkspaceOverview",
          component: () => import("@/modules/workspace/pages/WorkspaceOverview.vue"),
        },
        {
          path: "projects",
          name: "ProjectList",
          component: () => import("@/modules/project/pages/ProjectList.vue"),
        },
        {
          path: "projects/:projectId",
          name: "ProjectDetail",
          component: () => import("@/modules/project/pages/ProjectDetail.vue"),
        },
        {
          path: "runs/:runId",
          name: "RunDetail",
          component: () => import("@/modules/run/pages/RunDetail.vue"),
        },
        {
          path: "artifacts",
          name: "ArtifactList",
          component: () => import("@/modules/artifact/pages/ArtifactList.vue"),
        },
        {
          path: "sweeps",
          name: "SweepList",
          component: () => import("@/modules/sweep/pages/SweepList.vue"),
        },
        {
          path: "registry",
          name: "RegistryList",
          component: () => import("@/modules/registry-model/pages/RegistryList.vue"),
        },
        {
          path: "evaluations",
          name: "EvaluationList",
          component: () => import("@/modules/evaluation/pages/EvaluationList.vue"),
        },
        {
          path: "traces",
          name: "TraceList",
          component: () => import("@/modules/trace/pages/TraceList.vue"),
        },
        {
          path: "reports",
          name: "ReportList",
          component: () => import("@/modules/report/pages/ReportList.vue"),
        },
        {
          path: "settings",
          name: "Settings",
          component: () => import("@/modules/workspace/pages/Settings.vue"),
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      name: "NotFound",
      component: () => import("@/components/NotFound.vue"),
    },
  ],
});

export { router };
