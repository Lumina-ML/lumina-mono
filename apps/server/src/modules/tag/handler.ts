import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { TagService } from "./service.js";
import {
  AttachTagByNameSchema,
  AttachTagSchema,
  CreateTagSchema,
} from "./schema.js";
import { ProjectService } from "../project/service.js";
import { RunService } from "../run/service.js";
import { assertOwnsTag } from "../../core/authz/assert-workspace.js";

const ProjectParamsSchema = z.object({ projectId: z.string().uuid() });
const RunParamsSchema = z.object({ runId: z.string().uuid() });
const RunTagParamsSchema = z.object({
  runId: z.string().uuid(),
  tagId: z.string().uuid(),
});

export class TagHandler {
  constructor(
    private readonly tagService: TagService,
    private readonly projectService: ProjectService,
    private readonly runService: RunService,
  ) {}

  async create(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    // Workspace ownership is enforced by the `workspaceGuardPlugin`
    // preHandler hook via `config.authz` on this route.
    const data = CreateTagSchema.parse(req.body);
    const tag = await this.tagService.create(projectId, data);
    reply.status(201).send(tag);
  }

  async listByProject(req: FastifyRequest, reply: FastifyReply) {
    const { projectId } = ProjectParamsSchema.parse(req.params);
    const tags = await this.tagService.listByProject(projectId);
    reply.send({ items: tags });
  }

  async attachToRun(req: FastifyRequest, reply: FastifyReply) {
    const { runId } = RunParamsSchema.parse(req.params);
    // Run-side workspace ownership is enforced by the preHandler hook.
    const run = await this.runService.getByRunId(runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    let tagId: string;
    if (body && typeof body === "object" && "tagId" in body) {
      const data = AttachTagSchema.parse(body);
      tagId = data.tagId;
      // Body-derived guard: tagId comes from req.body, so the route
      // config can't cover it. Verify the tag lives in the requestor's
      // workspace before accepting the attach — otherwise the run-side
      // guard alone would let cross-workspace tag attachments through.
      if (!(await assertOwnsTag(req.server.prisma, req, reply, tagId))) return;
      const tag = await this.tagService["repository"].findById(tagId);
      if (!tag || tag.projectId !== run.projectId) {
        reply.status(404).send({ error: "Tag not found" });
        return;
      }
    } else {
      const data = AttachTagByNameSchema.parse(body);
      const tag = await this.tagService.findOrCreate(run.projectId, {
        name: data.name,
        color: data.color,
      });
      tagId = tag.id;
    }

    await this.tagService.attachToRun(run.runId, tagId);
    reply.status(201).send({ success: true });
  }

  async listByRun(req: FastifyRequest, reply: FastifyReply) {
    const { runId } = RunParamsSchema.parse(req.params);
    const run = await this.runService.getByRunId(runId);
    if (!run) {
      reply.status(404).send({ error: "Run not found" });
      return;
    }
    const tags = await this.tagService.listByRun(run.runId);
    reply.send({ items: tags });
  }

  async detachFromRun(req: FastifyRequest, reply: FastifyReply) {
    const { runId, tagId } = RunTagParamsSchema.parse(req.params);
    // Both runId and tagId guards are enforced by the preHandler hook
    // (route declares an array rule covering both params).
    await this.tagService.detachFromRun(runId, tagId);
    reply.status(204).send();
  }
}
