import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { LocalStorageProvider } from "./local.js";

export async function storageLocalRoutes(app: FastifyInstance) {
  if (!(app.storage instanceof LocalStorageProvider)) {
    return;
  }

  const provider = app.storage;

  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer" },
    (_req, body, done) => {
      done(null, body);
    },
  );

  app.put("/uploads/*", async (req: FastifyRequest, reply: FastifyReply) => {
    const key = decodeURIComponent((req.params as Record<string, string>)["*"]);
    const data = req.body as Buffer;
    await provider.put(key, data);
    reply.status(201).send({ success: true });
  });

  app.get("/uploads/*", async (req: FastifyRequest, reply: FastifyReply) => {
    const key = decodeURIComponent((req.params as Record<string, string>)["*"]);
    const stream = await provider.getStream(key);
    reply.send(stream);
  });
}
