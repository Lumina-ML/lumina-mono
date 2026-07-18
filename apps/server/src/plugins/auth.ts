import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; email: string; apiKey: string | null };
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest("user", undefined);

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const apiKey = authHeader.slice("Bearer ".length).trim();
      const user = await req.server.prisma.user.findUnique({
        where: { apiKey },
        select: { id: true, email: true, apiKey: true },
      });
      if (user) {
        req.user = user;
      }
    }
  });
});

export function requireAuth(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!req.user) {
    reply.status(401).send({ error: "Unauthorized" });
    return false;
  }
  return true;
}
