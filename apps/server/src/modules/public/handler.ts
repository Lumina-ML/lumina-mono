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
      const project = await this.projectService.findByName(
        req.workspaceId,
        query.project,
      );
      projectId = project?.id;
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
    // workspaceId falls back to the request's resolved workspace so a
    // public caller without `?workspaceId=` still gets *some* scoped
    // result. Callers that need cross-workspace visibility pass the id
    // explicitly (or hold an admin role — not modelled yet).
    const workspaceId = query.workspaceId ?? req.workspaceId;
    const result = await this.projectService.list(workspaceId, {
      limit: query.limit,
      offset: query.offset,
    });
    reply.send(result);
  }
}