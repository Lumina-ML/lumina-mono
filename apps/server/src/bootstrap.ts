import cors from "@fastify/cors";
import fastify from "fastify";
import { prismaPlugin } from "./plugins/prisma.js";
import { logLineRoutes } from "./modules/log-line/routes.js";
import { metricRoutes } from "./modules/metric/routes.js";
import { projectRoutes } from "./modules/project/routes.js";
import { runRoutes } from "./modules/run/routes.js";
import { systemMetricRoutes } from "./modules/system-metric/routes.js";

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

  await app.register(projectRoutes, { prefix: "/api/v1" });
  await app.register(runRoutes, { prefix: "/api/v1" });
  await app.register(metricRoutes, { prefix: "/api/v1" });
  await app.register(systemMetricRoutes, { prefix: "/api/v1" });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
