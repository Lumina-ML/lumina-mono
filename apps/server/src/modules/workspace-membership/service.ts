import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { TOKENS } from "../../core/di/tokens.js";
import type {
  CreateWorkspaceMembershipInput,
  UpdateWorkspaceMembershipInput,
} from "./schema.js";
import { WorkspaceMembershipRepository } from "./repository.js";

@injectable()
export class WorkspaceMembershipService {
  private readonly repository: WorkspaceMembershipRepository;

  constructor(@inject(TOKENS.PrismaClient) prisma: PrismaClient) {
    this.repository = new WorkspaceMembershipRepository(prisma);
  }

  async createMembership(data: CreateWorkspaceMembershipInput) {
    return this.repository.createMembership(data);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async listByWorkspace(workspaceId: string) {
    return this.repository.listByWorkspace(workspaceId);
  }

  async listByUser(userId: string) {
    return this.repository.listByUser(userId);
  }

  async updateMembership(id: string, data: UpdateWorkspaceMembershipInput) {
    return this.repository.updateMembership(id, data);
  }

  async deleteMembership(id: string) {
    return this.repository.deleteMembership(id);
  }
}
