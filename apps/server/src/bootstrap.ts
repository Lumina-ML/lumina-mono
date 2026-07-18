import cors from "@fastify/cors";
import fastify from "fastify";
import { prismaPlugin } from "./plugins/prisma.js";
import { metricRoutes } from "./modules/metric/routes.js";
import { runRoutes } from "./modules/run/routes.js";

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

  await app.register(runRoutes, { prefix: "/api/v1" });
  await app.register(metricRoutes, { prefix: "/api/v1" });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
