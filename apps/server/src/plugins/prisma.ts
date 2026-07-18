import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "../generated/prisma/index.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (app: FastifyInstance) => {
  const prisma = new PrismaClient({
    log:
      app.config.nodeEnv === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

  await prisma.$connect();
  app.decorate("prisma", prisma);

  app.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
  });
});
