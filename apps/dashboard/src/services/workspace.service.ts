import { fetchApi } from "./api";

/** Mirrors the backend's WorkspaceMembership model. */
export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

/** Mirrors the backend's User model (light subset). */
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

/** Backend exposes these endpoints under workspace-membership routes. */
export const WorkspaceService = {
  listMemberships(workspaceId: string): Promise<WorkspaceMembership[]> {
    return fetchApi(`/api/v1/workspaces/${workspaceId}/memberships`);
  },

  createMembership(input: {
    workspaceId: string;
    userId: string;
    role?: WorkspaceMembership["role"];
  }): Promise<WorkspaceMembership> {
    return fetchApi("/api/v1/workspace-memberships", {
      method: "POST",
      body: input,
    });
  },

  updateMembership(
    membershipId: string,
    data: { role: WorkspaceMembership["role"] },
  ): Promise<WorkspaceMembership> {
    return fetchApi(`/api/v1/workspace-memberships/${membershipId}`, {
      method: "PATCH",
      body: data,
    });
  },

  removeMembership(membershipId: string): Promise<void> {
    return fetchApi(`/api/v1/workspace-memberships/${membershipId}`, {
      method: "DELETE",
    });
  },

  listUsers(): Promise<User[]> {
    return fetchApi("/api/v1/users");
  },

  generateApiKey(userId: string): Promise<{ apiKey: string }> {
    return fetchApi(`/api/v1/users/${userId}/api-key`, { method: "POST" });
  },
};