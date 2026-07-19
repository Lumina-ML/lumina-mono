import type { FastifyInstance } from "fastify";
import { LaunchService } from "./service.js";
import { LaunchHandler } from "./handler.js";
import { ProjectService } from "../project/service.js";

export async function launchRoutes(app: FastifyInstance) {
  const launchService = new LaunchService(app.prisma);
  const projectService = new ProjectService(app.prisma);
  const handler = new LaunchHandler(launchService, projectService);

  app.post("/projects/:projectId/launch-queues", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.createQueue.bind(handler));
  app.get("/projects/:projectId/launch-queues", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.listQueues.bind(handler));
  app.get("/launch-queues/:queueId", {
    config: { authz: { kind: "launchQueue", param: "queueId" } },
  }, handler.getQueue.bind(handler));

  app.post("/projects/:projectId/launch-jobs", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.createJob.bind(handler));
  app.get("/projects/:projectId/launch-jobs", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.listJobs.bind(handler));
  app.get("/launch-jobs/:jobId", {
    config: { authz: { kind: "launchJob", param: "jobId" } },
  }, handler.getJob.bind(handler));

  app.post("/projects/:projectId/launch-runs", {
    config: { authz: { kind: "project", param: "projectId" } },
  }, handler.createRun.bind(handler));
  app.get("/launch-queues/:queueId/runs", {
    config: { authz: { kind: "launchQueue", param: "queueId" } },
  }, handler.listRunsByQueue.bind(handler));
  app.get("/launch-runs/:runId", {
    config: { authz: { kind: "launchRun", param: "runId" } },
  }, handler.getRun.bind(handler));
  app.patch("/launch-runs/:runId", {
    config: { authz: { kind: "launchRun", param: "runId" } },
  }, handler.patchRun.bind(handler));
  app.post("/launch-queues/:queueId/dequeue", {
    config: { authz: { kind: "launchQueue", param: "queueId" } },
  }, handler.dequeueRun.bind(handler));
}
