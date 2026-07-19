import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/index.js";
import { UserService } from "./service.js";
import {
  CreateUserSchema,
  UpdateUserSchema,
  GenerateApiKeySchema,
  RotateKeyByEmailParamsSchema,
} from "./schema.js";
import { requireAuth } from "../../plugins/auth.js";
import type { FixedWindowRateLimiter } from "../../shared/rate-limiter.js";

const UserParamsSchema = z.object({ userId: z.string().uuid() });

/** Deps for the unauthenticated "forgot key" flow. */
export interface RotateKeyDeps {
  /** Lowercased allowlist of emails permitted to self-rotate. */
  allowlist: Set<string>;
  /** Shared limiter; keys are prefixed per email / per IP. */
  limiter: FixedWindowRateLimiter;
}

export class UserHandler {
  constructor(
    private readonly userService: UserService,
    private readonly rotateKey?: RotateKeyDeps,
  ) {}

  async createUser(req: FastifyRequest, reply: FastifyReply) {
    const data = CreateUserSchema.parse(req.body);
    try {
      const { user, apiKey } = await this.userService.createUser(data);
      // Return both so the open-source onboarding flow can sign the
      // user in immediately. The SDK still receives a usable user
      // record (apiKey is an additional field, not a breaking change).
      reply.status(201).send({ ...user, apiKey });
    } catch (err) {
      // Email / apiKey uniqueness races (two tabs hitting bootstrap at
      // the same time, or a stale "first-run" view on an already-seeded
      // server) otherwise surface as opaque 500s with Prisma internals.
      // Map them to 409 with a structured body the client can branch on.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = (err.meta?.target as string[] | undefined) ?? [];
        const field = target[0] ?? "field";
        reply.status(409).send({
          error: "Conflict",
          message: `A user with this ${field} already exists.`,
          field,
        });
        return;
      }
      throw err;
    }
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

  /**
   * Unauthenticated self-service key recovery: `POST /users/:email/rotate-key`.
   *
   * This is the only route that hands a live key to an anonymous caller, so it
   * is locked down on three axes:
   *   1. Allowlist — only emails in `LUMINA_ROTATE_KEY_EMAILS` are eligible.
   *      An empty allowlist (the default) disables the feature outright.
   *   2. Indistinguishable failures — an allowlist miss AND a missing user
   *      both return the same 404, so an attacker can't enumerate which
   *      emails are registered or allowlisted.
   *   3. Rate limiting — per-email and per-IP fixed windows blunt brute force.
   */
  async rotateKeyByEmail(req: FastifyRequest, reply: FastifyReply) {
    // Feature disabled entirely when no deps were wired (no allowlist set).
    if (!this.rotateKey || this.rotateKey.allowlist.size === 0) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const { email } = RotateKeyByEmailParamsSchema.parse(req.params);
    const normalized = email.trim().toLowerCase();

    // Rate-limit BEFORE the allowlist check so probing is throttled even for
    // non-allowlisted emails. Charge both the email and the source IP; either
    // tripping its window rejects the attempt.
    const emailOk = this.rotateKey.limiter.hit(`email:${normalized}`);
    const ipOk = this.rotateKey.limiter.hit(`ip:${req.ip}`);
    if (!emailOk || !ipOk) {
      reply
        .status(429)
        .send({ error: "Too many requests", message: "Try again later." });
      return;
    }

    if (!this.rotateKey.allowlist.has(normalized)) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const result = await this.userService.rotateApiKeyByEmail(normalized);
    if (!result) {
      // Allowlisted but no such user — stay indistinguishable from a miss.
      reply.status(404).send({ error: "Not found" });
      return;
    }

    reply.send({ apiKey: result.apiKey });
  }
}
