import type { FastifyInstance } from "fastify";
import { LaunchService } from "./service.js";
import { LaunchHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function launchRoutes(app: FastifyInstance) {
  const launchService = new LaunchService(app.prisma);
  const projectService = new ProjectService(app.prisma);
  const handler = new LaunchHandler(launchService, projectService);

  app.post("/projects/:projectId/launch-queues", handler.createQueue.bind(handler));
  app.get("/projects/:projectId/launch-queues", handler.listQueues.bind(handler));
  app.get("/launch-queues/:queueId", handler.getQueue.bind(handler));

  app.post("/projects/:projectId/launch-jobs", handler.createJob.bind(handler));
  app.get("/projects/:projectId/launch-jobs", handler.listJobs.bind(handler));
  app.get("/launch-jobs/:jobId", handler.getJob.bind(handler));

  app.post("/projects/:projectId/launch-runs", handler.createRun.bind(handler));
  app.get("/launch-queues/:queueId/runs", handler.listRunsByQueue.bind(handler));
  app.get("/launch-runs/:runId", handler.getRun.bind(handler));
  app.patch("/launch-runs/:runId", handler.patchRun.bind(handler));
  app.post("/launch-queues/:queueId/dequeue", handler.dequeueRun.bind(handler));
}
