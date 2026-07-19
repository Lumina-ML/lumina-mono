import type { FastifyInstance } from "fastify";
import { UserService } from "./service.js";
import { UserHandler } from "./handler.js";
import { FixedWindowRateLimiter } from "../../shared/rate-limiter.js";

export async function userRoutes(app: FastifyInstance) {
  const userService = new UserService(app.prisma);

  // Wire the unauthenticated "forgot key" flow from config. The allowlist is
  // lowercased in `loadConfig`; an empty allowlist disables the endpoint.
  // One shared limiter, keyed per email + per IP: 5 attempts / 15 min.
  const handler = new UserHandler(userService, {
    allowlist: new Set(app.config.rotateKeyEmails),
    limiter: new FixedWindowRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }),
  });

  app.post("/users", handler.createUser.bind(handler));
  app.get("/users", handler.listUsers.bind(handler));
  app.get("/users/me", handler.getCurrentUser.bind(handler));
  app.get("/users/:userId", handler.getUser.bind(handler));
  app.patch("/users/:userId", handler.updateUser.bind(handler));
  app.delete("/users/:userId", handler.deleteUser.bind(handler));
  app.post("/users/:userId/api-key", handler.generateApiKey.bind(handler));
  // Unauthenticated key recovery — see UserHandler.rotateKeyByEmail.
  app.post("/users/:email/rotate-key", handler.rotateKeyByEmail.bind(handler));
}
