import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { loadConfig, type ServerConfig } from "../config/index.js";

declare module "fastify" {
  interface FastifyInstance {
    config: ServerConfig;
  }
}

export const configPlugin = fp(async (app: FastifyInstance) => {
  const config = loadConfig();
  app.decorate("config", config);
});
