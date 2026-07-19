import { createRouter, createWebHistory } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import ProjectWorkspaceLayout from "@/modules/project/layouts/ProjectWorkspaceLayout.vue";
import SettingsLayout from "@/modules/workspace/layouts/SettingsLayout.vue";
import { useAuthStore } from "@/stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Auth — outside AppLayout so logged-out users never see the chrome.
    {
      path: "/login",
      name: "Login",
      component: () => import("@/modules/auth/pages/LoginPage.vue"),
      meta: { public: true },
    },
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
          path: "launch",
          name: "LaunchMonitor",
          component: () => import("@/modules/launch/pages/LaunchMonitor.vue"),
        },
        {
          path: "monitoring",
          name: "Monitoring",
          component: () => import("@/modules/monitoring/pages/Monitoring.vue"),
        },
        {
          path: "settings",
          component: SettingsLayout,
          children: [
            {
              path: "",
              name: "Settings",
              component: () => import("@/modules/workspace/pages/SettingsProfile.vue"),
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
              path: "reports/:reportId/edit",
              name: "ReportEditor",
              component: () => import("@/modules/report/pages/ReportEditor.vue"),
              props: true,
            },
            {
              path: "evaluations",
              name: "ProjectEvaluations",
              component: () => import("@/modules/evaluation/pages/ProjectEvaluations.vue"),
            },
            {
              path: "evaluations/:evaluationId",
              name: "EvaluationDetail",
              component: () => import("@/modules/evaluation/pages/EvaluationDetail.vue"),
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

        // ─── Workspace-wide (cross-project) views ─────────────────────
        // Top-level sweeps/artifacts/traces/etc. routes show a "coming
        // soon" stub pointing users to the project-scoped versions,
        // which are fully implemented under `/projects/:projectId/...`.
        {
          path: "datasets",
          name: "GlobalDatasets",
          component: () => import("@/pages/GlobalDatasets.vue"),
        },
        {
          path: "sweeps",
          name: "GlobalSweeps",
          component: () => import("@/pages/GlobalSweeps.vue"),
        },
        {
          path: "artifacts",
          name: "GlobalArtifacts",
          component: () => import("@/pages/GlobalArtifacts.vue"),
        },
        {
          path: "registry",
          redirect: "/models",
        },
        {
          path: "evaluations",
          name: "GlobalEvaluations",
          component: () => import("@/pages/GlobalEvaluations.vue"),
        },
        {
          path: "traces",
          name: "GlobalTraces",
          component: () => import("@/pages/GlobalTraces.vue"),
        },
        {
          path: "reports",
          name: "GlobalReports",
          component: () => import("@/pages/GlobalReports.vue"),
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
      meta: { public: true },
    },
  ],
});

/**
 * Global guard. Routes marked `meta.public = true` (login, 404) skip
 * the check. Everything else requires an API key; missing key redirects
 * to /login with a `?redirect=…` hint so the user lands back where they
 * were after sign-in.
 */
router.beforeEach((to) => {
  if (to.meta.public) return true;
  const auth = useAuthStore();
  if (auth.isAuthenticated) return true;
  return {
    name: "Login",
    query: { redirect: to.fullPath },
  };
});

export { router };