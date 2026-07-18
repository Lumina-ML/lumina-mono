import type { FastifyInstance } from "fastify";
import { WorkspaceMembershipService } from "./service.js";
import { WorkspaceMembershipHandler } from "./handler.js";

export async function workspaceMembershipRoutes(app: FastifyInstance) {
  const membershipService = new WorkspaceMembershipService(app.prisma);
  const handler = new WorkspaceMembershipHandler(membershipService);

  app.post("/workspace-memberships", handler.createMembership.bind(handler));
  app.get("/workspaces/:workspaceId/memberships", handler.listByWorkspace.bind(handler));
  app.get("/users/:userId/memberships", handler.listByUser.bind(handler));
  app.get("/workspace-memberships/:membershipId", handler.getMembership.bind(handler));
  app.patch("/workspace-memberships/:membershipId", handler.updateMembership.bind(handler));
  app.delete("/workspace-memberships/:membershipId", handler.deleteMembership.bind(handler));
}
