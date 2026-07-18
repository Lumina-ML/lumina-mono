import cors from "@fastify/cors";
import fastify from "fastify";
import { prismaPlugin } from "./plugins/prisma.js";
import { storagePlugin } from "./plugins/storage.js";
import { authPlugin } from "./plugins/auth.js";
import { artifactRoutes } from "./modules/artifact/routes.js";
import { evaluationRoutes } from "./modules/evaluation/routes.js";
import { logLineRoutes } from "./modules/log-line/routes.js";
import { traceRoutes } from "./modules/trace/routes.js";
import { reportRoutes } from "./modules/report/routes.js";
import { runMediaRoutes } from "./modules/run-media/routes.js";
import { launchRoutes } from "./modules/launch/routes.js";
import { metricRoutes } from "./modules/metric/routes.js";
import { projectRoutes } from "./modules/project/routes.js";
import { registryModelRoutes } from "./modules/registry-model/routes.js";
import { userRoutes } from "./modules/user/routes.js";
import { workspaceMembershipRoutes } from "./modules/workspace-membership/routes.js";
import { runRoutes } from "./modules/run/routes.js";
import { sweepRoutes } from "./modules/sweep/routes.js";
import { systemMetricRoutes } from "./modules/system-metric/routes.js";
import { tagRoutes } from "./modules/tag/routes.js";
import { storageLocalRoutes } from "./storage/routes.js";

const DEFAULT_WORKSPACE_ID = "default";

export async function buildApp() {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(storagePlugin);

  // Ensure default workspace exists
  await app.prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    create: {
      id: DEFAULT_WORKSPACE_ID,
      name: "default",
      displayName: "Default Workspace",
    },
    update: {},
  });

  await app.register(userRoutes, { prefix: "/api/v1" });
  await app.register(workspaceMembershipRoutes, { prefix: "/api/v1" });
  await app.register(projectRoutes, { prefix: "/api/v1" });
  await app.register(runRoutes, { prefix: "/api/v1" });
  await app.register(metricRoutes, { prefix: "/api/v1" });
  await app.register(systemMetricRoutes, { prefix: "/api/v1" });
  await app.register(logLineRoutes, { prefix: "/api/v1" });
  await app.register(tagRoutes, { prefix: "/api/v1" });
  await app.register(sweepRoutes, { prefix: "/api/v1" });
  await app.register(artifactRoutes, { prefix: "/api/v1" });
  await app.register(registryModelRoutes, { prefix: "/api/v1" });
  await app.register(evaluationRoutes, { prefix: "/api/v1" });
  await app.register(traceRoutes, { prefix: "/api/v1" });
  await app.register(reportRoutes, { prefix: "/api/v1" });
  await app.register(runMediaRoutes, { prefix: "/api/v1" });
  await app.register(launchRoutes, { prefix: "/api/v1" });
  await app.register(storageLocalRoutes, { prefix: "/api/v1" });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
