import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { WorkspaceMembershipService } from "./service.js";
import {
  CreateWorkspaceMembershipSchema,
  UpdateWorkspaceMembershipSchema,
} from "./schema.js";
import { requireAuth } from "../../plugins/auth.js";

const MembershipParamsSchema = z.object({ membershipId: z.string().uuid() });
// Same rationale as CreateWorkspaceMembershipSchema: a path segment may
// carry the literal "default" or a future slug.
const WorkspaceParamsSchema = z.object({ workspaceId: z.string().min(1).max(64) });
const UserParamsSchema = z.object({ userId: z.string().uuid() });

export class WorkspaceMembershipHandler {
  constructor(private readonly membershipService: WorkspaceMembershipService) {}

  async createMembership(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const data = CreateWorkspaceMembershipSchema.parse(req.body);
    const membership = await this.membershipService.createMembership(data);
    reply.status(201).send(membership);
  }

  async listByWorkspace(req: FastifyRequest, reply: FastifyReply) {
    const { workspaceId } = WorkspaceParamsSchema.parse(req.params);
    const memberships = await this.membershipService.listByWorkspace(workspaceId);
    reply.send({ items: memberships });
  }

  async listByUser(req: FastifyRequest, reply: FastifyReply) {
    const { userId } = UserParamsSchema.parse(req.params);
    const memberships = await this.membershipService.listByUser(userId);
    reply.send({ items: memberships });
  }

  async getMembership(req: FastifyRequest, reply: FastifyReply) {
    const { membershipId } = MembershipParamsSchema.parse(req.params);
    const membership = await this.membershipService.findById(membershipId);
    if (!membership) {
      reply.status(404).send({ error: "Membership not found" });
      return;
    }
    reply.send(membership);
  }

  async updateMembership(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const { membershipId } = MembershipParamsSchema.parse(req.params);
    const data = UpdateWorkspaceMembershipSchema.parse(req.body);
    const membership = await this.membershipService.updateMembership(membershipId, data);
    reply.send(membership);
  }

  async deleteMembership(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const { membershipId } = MembershipParamsSchema.parse(req.params);
    await this.membershipService.deleteMembership(membershipId);
    reply.status(204).send();
  }
}
