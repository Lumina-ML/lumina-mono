import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateUserInput, UpdateUserInput, GenerateApiKeyInput } from "./schema.js";
import { UserRepository } from "./repository.js";

export class UserService {
  private readonly repository: UserRepository;

  constructor(prisma: PrismaClient) {
    this.repository = new UserRepository(prisma);
  }

  async createUser(data: CreateUserInput) {
    return this.repository.createUser(data);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async findByEmail(email: string) {
    return this.repository.findByEmail(email);
  }

  async findByApiKey(apiKey: string) {
    return this.repository.findByApiKey(apiKey);
  }

  async listUsers() {
    return this.repository.listUsers();
  }

  async updateUser(id: string, data: UpdateUserInput) {
    return this.repository.updateUser(id, data);
  }

  async deleteUser(id: string) {
    return this.repository.deleteUser(id);
  }

  async setApiKey(id: string, data: GenerateApiKeyInput) {
    return this.repository.setApiKey(id, data);
  }

  generateApiKey() {
    return this.repository.generateApiKey();
  }
}
