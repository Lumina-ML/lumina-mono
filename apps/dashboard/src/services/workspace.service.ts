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
  avatar: string | null;
  createdAt: string;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  avatar?: string;
}

export interface UpdateUserInput {
  name?: string;
  avatar?: string;
}

/** Backend exposes these endpoints under workspace-membership routes. */
export const WorkspaceService = {
  listMemberships(workspaceId: string): Promise<WorkspaceMembership[]> {
    return fetchApi(`/api/v1/workspaces/${workspaceId}/memberships`);
  },

  getMembership(membershipId: string): Promise<WorkspaceMembership> {
    return fetchApi(`/api/v1/workspace-memberships/${membershipId}`);
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

  getUser(userId: string): Promise<User> {
    return fetchApi(`/api/v1/users/${userId}`);
  },

  getCurrentUser(): Promise<User> {
    return fetchApi("/api/v1/users/me");
  },

  createUser(data: CreateUserInput): Promise<User> {
    return fetchApi("/api/v1/users", { method: "POST", body: data });
  },

  updateUser(userId: string, data: UpdateUserInput): Promise<User> {
    return fetchApi(`/api/v1/users/${userId}`, {
      method: "PATCH",
      body: data,
    });
  },

  deleteUser(userId: string): Promise<void> {
    return fetchApi(`/api/v1/users/${userId}`, { method: "DELETE" });
  },

  listUserMemberships(userId: string): Promise<WorkspaceMembership[]> {
    return fetchApi(`/api/v1/users/${userId}/memberships`);
  },

  generateApiKey(userId: string): Promise<{ apiKey: string }> {
    return fetchApi(`/api/v1/users/${userId}/api-key`, { method: "POST" });
  },
};
