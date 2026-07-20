import type { FastifyInstance } from "fastify";
import { ArtifactLinkHandler } from "./handler.js";
import { ArtifactLinkService } from "./service.js";

/**
 * Artifact-link module — `POST /api/v1/versions/:id/link`. Step 3.2
 * replacement for wandb's `LinkArtifact` GraphQL mutation. Adds a version
 * to a registry portfolio with optional aliases (``latest`` / ``v1.2``).
 */
export async function artifactLinkRoutes(app: FastifyInstance) {
  const service = new ArtifactLinkService(app.prisma);
  const handler = new ArtifactLinkHandler(service);

  app.post(
    "/versions/:id/link",
    {
      config: { authz: { kind: "artifactVersion", param: "id" } },
    },
    handler.link.bind(handler),
  );
}