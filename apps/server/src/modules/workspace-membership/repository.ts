import type { PrismaClient } from "../../generated/prisma/index.js";
import type {
  CreateWorkspaceMembershipInput,
  UpdateWorkspaceMembershipInput,
} from "./schema.js";

export class WorkspaceMembershipRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMembership(data: CreateWorkspaceMembershipInput) {
    return this.prisma.workspaceMembership.create({
      data: {
        workspaceId: data.workspaceId,
        userId: data.userId,
        role: data.role,
      },
      include: { workspace: true, user: true },
    });
  }

  async findById(id: string) {
    return this.prisma.workspaceMembership.findUnique({
      where: { id },
      include: { workspace: true, user: true },
    });
  }

  /**
   * Look up a membership by its composite key. Hits the
   * `@@unique([workspaceId, userId])` index directly — single row read.
   * Used by the workspace-guard helper to authorize detail-route access
   * without trusting `req.params` for cross-workspace enumeration.
   */
  async findByWorkspaceAndUser(workspaceId: string, userId: string) {
    return this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  async listByWorkspace(workspaceId: string) {
    return this.prisma.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });
  }

  async listByUser(userId: string) {
    return this.prisma.workspaceMembership.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { workspace: true },
    });
  }

  async updateMembership(id: string, data: UpdateWorkspaceMembershipInput) {
    return this.prisma.workspaceMembership.update({
      where: { id },
      data: { role: data.role },
      include: { workspace: true, user: true },
    });
  }

  async deleteMembership(id: string) {
    return this.prisma.workspaceMembership.delete({
      where: { id },
    });
  }
}
