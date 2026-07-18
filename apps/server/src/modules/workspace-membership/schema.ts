import { z } from "zod";

export const WorkspaceRoleSchema = z.enum([
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const CreateWorkspaceMembershipSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: WorkspaceRoleSchema.default("member"),
});

export const UpdateWorkspaceMembershipSchema = z.object({
  role: WorkspaceRoleSchema,
});

export type CreateWorkspaceMembershipInput = z.infer<typeof CreateWorkspaceMembershipSchema>;
export type UpdateWorkspaceMembershipInput = z.infer<typeof UpdateWorkspaceMembershipSchema>;
