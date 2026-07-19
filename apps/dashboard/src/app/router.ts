import { createRouter, createWebHistory } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import ProjectWorkspaceLayout from "@/modules/project/layouts/ProjectWorkspaceLayout.vue";
import SettingsLayout from "@/modules/workspace/layouts/SettingsLayout.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: AppLayout,
      children: [
        // ─── Global routes ───────────────────────────────────────────────
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
          path: "models",
          name: "RegistryList",
          component: () => import("@/modules/registry-model/pages/RegistryList.vue"),
        },
        {
          path: "models/:name/versions/:version",
          name: "ModelVersionDetail",
          component: () => import("@/modules/registry-model/pages/ModelVersionDetail.vue"),
          props: true,
        },
        {
          path: "settings",
          component: SettingsLayout,
          children: [
            {
              path: "",
              name: "Settings",
              component: () => import("@/modules/workspace/pages/Settings.vue"),
            },
            {
              path: "members",
              name: "SettingsMembers",
              component: () => import("@/modules/workspace/pages/SettingsMembers.vue"),
            },
            {
              path: "api-keys",
              name: "SettingsApiKeys",
              component: () => import("@/modules/workspace/pages/SettingsApiKeys.vue"),
            },
            {
              path: "billing",
              name: "SettingsBilling",
              component: () => import("@/modules/workspace/pages/SettingsBilling.vue"),
            },
          ],
        },

        // ─── Project-scoped routes (share ProjectWorkspaceLayout) ────────
        {
          path: "projects/:projectId",
          component: ProjectWorkspaceLayout,
          children: [
            {
              path: "",
              name: "ProjectWorkspace",
              component: () => import("@/modules/project/pages/ProjectWorkspace.vue"),
            },
            {
              path: "runs",
              name: "ProjectRuns",
              component: () => import("@/modules/project/pages/ProjectRuns.vue"),
            },
            {
              path: "runs/:runId",
              name: "RunDetail",
              component: () => import("@/modules/run/pages/RunDetail.vue"),
              props: true,
            },
            {
              path: "sweeps",
              name: "ProjectSweeps",
              component: () => import("@/modules/project/pages/ProjectSweeps.vue"),
            },
            {
              path: "sweeps/:sweepId",
              name: "SweepDetail",
              component: () => import("@/modules/sweep/pages/SweepDetail.vue"),
              props: true,
            },
            {
              path: "artifacts",
              name: "ProjectArtifacts",
              component: () => import("@/modules/project/pages/ProjectArtifacts.vue"),
            },
            {
              path: "artifacts/:artifactId",
              name: "ArtifactDetail",
              component: () => import("@/modules/artifact/pages/ArtifactDetail.vue"),
              props: true,
            },
            {
              path: "reports",
              name: "ProjectReports",
              component: () => import("@/modules/project/pages/ProjectReports.vue"),
            },
            {
              path: "reports/:reportId",
              name: "ReportDetail",
              component: () => import("@/modules/report/pages/ReportDetail.vue"),
              props: true,
            },
            {
              path: "traces",
              name: "ProjectTraces",
              component: () => import("@/modules/project/pages/ProjectTraces.vue"),
            },
            {
              path: "traces/:traceId",
              name: "TraceDetail",
              component: () => import("@/modules/trace/pages/TraceDetail.vue"),
              props: true,
            },
            {
              path: "launch",
              name: "ProjectLaunch",
              component: () => import("@/modules/project/pages/ProjectLaunch.vue"),
            },
            {
              path: "settings",
              name: "ProjectSettings",
              component: () => import("@/modules/project/pages/ProjectSettings.vue"),
            },
          ],
        },

        // ─── Backward-compatible aliases ────────────────────────────────
        // Old global list paths collapse to projects (ProjectList shows all).
        {
          path: "sweeps",
          redirect: "/projects",
        },
        {
          path: "artifacts",
          redirect: "/projects",
        },
        {
          path: "registry",
          redirect: "/models",
        },
        {
          path: "evaluations",
          redirect: "/projects",
        },
        {
          path: "traces",
          redirect: "/projects",
        },
        {
          path: "reports",
          redirect: "/projects",
        },
        // Legacy run detail: fetch the run to learn its projectId, then
        // redirect to the canonical /projects/:id/runs/:runId URL.
        {
          path: "runs/:runId",
          name: "RunDetailLegacy",
          component: () => import("@/modules/run/pages/RunDetailRedirect.vue"),
          props: true,
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