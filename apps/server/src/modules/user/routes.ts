import type { FastifyInstance } from "fastify";
import { UserService } from "./service.js";
import { UserHandler } from "./handler.js";

export async function userRoutes(app: FastifyInstance) {
  const userService = new UserService(app.prisma);
  const handler = new UserHandler(userService);

  app.post("/users", handler.createUser.bind(handler));
  app.get("/users", handler.listUsers.bind(handler));
  app.get("/users/me", handler.getCurrentUser.bind(handler));
  app.get("/users/:userId", handler.getUser.bind(handler));
  app.patch("/users/:userId", handler.updateUser.bind(handler));
  app.delete("/users/:userId", handler.deleteUser.bind(handler));
  app.post("/users/:userId/api-key", handler.generateApiKey.bind(handler));
}
