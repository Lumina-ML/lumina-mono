import crypto from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/index.js";
import type { CreateUserInput, UpdateUserInput, GenerateApiKeyInput } from "./schema.js";

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createUser(data: CreateUserInput & { apiKey?: string }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        avatar: data.avatar,
        apiKey: data.apiKey,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { memberships: { include: { workspace: true } } },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { workspace: true } } },
    });
  }

  async findByApiKey(apiKey: string) {
    return this.prisma.user.findUnique({
      where: { apiKey },
      select: { id: true, email: true, apiKey: true },
    });
  }

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { memberships: { include: { workspace: true } } },
    });
  }

  async updateUser(id: string, data: UpdateUserInput) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async setApiKey(id: string, data: GenerateApiKeyInput) {
    return this.prisma.user.update({
      where: { id },
      data: { apiKey: data.apiKey },
    });
  }

  generateApiKey() {
    return crypto.randomBytes(32).toString("hex");
  }
}
