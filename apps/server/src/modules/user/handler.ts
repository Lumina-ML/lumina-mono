import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { UserService } from "./service.js";
import { CreateUserSchema, UpdateUserSchema, GenerateApiKeySchema } from "./schema.js";
import { requireAuth } from "../../plugins/auth.js";

const UserParamsSchema = z.object({ userId: z.string().uuid() });

export class UserHandler {
  constructor(private readonly userService: UserService) {}

  async createUser(req: FastifyRequest, reply: FastifyReply) {
    const data = CreateUserSchema.parse(req.body);
    const { user, apiKey } = await this.userService.createUser(data);
    // Return both so the open-source onboarding flow can sign the
    // user in immediately. The SDK still receives a usable user
    // record (apiKey is an additional field, not a breaking change).
    reply.status(201).send({ ...user, apiKey });
  }

  async listUsers(req: FastifyRequest, reply: FastifyReply) {
    const users = await this.userService.listUsers();
    reply.send({ items: users });
  }

  async getUser(req: FastifyRequest, reply: FastifyReply) {
    const { userId } = UserParamsSchema.parse(req.params);
    const user = await this.userService.findById(userId);
    if (!user) {
      reply.status(404).send({ error: "User not found" });
      return;
    }
    reply.send(user);
  }

  async getCurrentUser(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const user = await this.userService.findById(req.user!.id);
    if (!user) {
      reply.status(404).send({ error: "User not found" });
      return;
    }
    reply.send(user);
  }

  async updateUser(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const { userId } = UserParamsSchema.parse(req.params);
    const data = UpdateUserSchema.parse(req.body);
    const user = await this.userService.updateUser(userId, data);
    reply.send(user);
  }

  async deleteUser(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const { userId } = UserParamsSchema.parse(req.params);
    await this.userService.deleteUser(userId);
    reply.status(204).send();
  }

  async generateApiKey(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const { userId } = UserParamsSchema.parse(req.params);
    const apiKey = this.userService.generateApiKey();
    const user = await this.userService.setApiKey(userId, { apiKey });
    reply.send({ apiKey, user });
  }
}
