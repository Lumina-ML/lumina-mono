import type { FastifyReply, FastifyRequest } from "fastify";
import { RunService } from "../run/service.js";
import { ProjectService } from "../project/service.js";
import {
  ListPublicProjectsQuerySchema,
  ListPublicRunsQuerySchema,
} from "./schema.js";

/**
 * Read-only handler for the public surface. Reuses the existing
 * `RunService` / `ProjectService` so the public shape is the same as
 * the private one — keeping a single source of truth for run + project
 * serialisation. When the public schema needs to diverge (e.g. drop
 * internal-only fields), this is where the projection should happen.
 */
export class PublicHandler {
  constructor(
    private readonly runService: RunService,
    private readonly projectService: ProjectService,
  ) {}

  async listRuns(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const query = ListPublicRunsQuerySchema.parse(req.query);

    let projectId: string | undefined;
    if (query.project) {
      // Resolve the project name in the requestor's own workspace. If the
      // project doesn't exist there (or lives in another workspace the
      // caller doesn't belong to), 404 — don't silently fall through to
      // an unscoped list, which would leak runs.
      const project = await this.projectService.findByName(
        req.workspaceId,
        query.project,
      );
      if (!project) {
        reply.status(404).send({ error: "Project not found" });
        return;
      }
      projectId = project.id;
    }

    const result = await this.runService.list({
      projectId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
    reply.send(result);
  }

  async listProjects(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = ListPublicProjectsQuerySchema.parse(req.query);
    // Always scoped to the requestor's workspace. The optional `?workspaceId=`
    // query param is honoured only when it matches `req.workspaceId`; any
    // other value would let a caller enumerate projects in workspaces they
    // don't belong to, so we 404 instead.
    const requestedWorkspace = query.workspaceId ?? req.workspaceId;
    if (query.workspaceId && query.workspaceId !== req.workspaceId) {
      reply.status(404).send({ error: "Workspace not found" });
      return;
    }
    const result = await this.projectService.list(requestedWorkspace, {
      limit: query.limit,
      offset: query.offset,
    });
    reply.send(result);
  }
}