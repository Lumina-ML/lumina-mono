import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateProjectInput, UpdateProjectInput } from "./schema.js";
import { ProjectRepository } from "./repository.js";

export class ProjectService {
  private readonly repository: ProjectRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new ProjectRepository(prisma);
  }

  async create(workspaceId: string, data: CreateProjectInput) {
    return this.repository.create(workspaceId, data);
  }

  async findByName(workspaceId: string, name: string) {
    return this.repository.findByName(workspaceId, name);
  }

  async findOrCreate(workspaceId: string, data: CreateProjectInput) {
    return this.repository.findOrCreate(workspaceId, data);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async list(workspaceId: string, params: { limit: number; offset: number }) {
    return this.repository.list(workspaceId, params);
  }

  async update(id: string, data: UpdateProjectInput) {
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    return this.repository.delete(id);
  }
}
