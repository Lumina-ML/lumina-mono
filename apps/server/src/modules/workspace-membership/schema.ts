import { z } from "zod";

export const WorkspaceRoleSchema = z.enum([
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const CreateWorkspaceMembershipSchema = z.object({
  // Workspace.id is a String (not a UUID) — the bootstrap seed uses the
  // literal id "default", and future custom workspaces may use slug ids
  // too. Accept any non-empty identifier up to 64 chars.
  workspaceId: z.string().min(1).max(64),
  userId: z.string().uuid(),
  role: WorkspaceRoleSchema.default("member"),
});

export const UpdateWorkspaceMembershipSchema = z.object({
  role: WorkspaceRoleSchema,
});

export type CreateWorkspaceMembershipInput = z.infer<typeof CreateWorkspaceMembershipSchema>;
export type UpdateWorkspaceMembershipInput = z.infer<typeof UpdateWorkspaceMembershipSchema>;
