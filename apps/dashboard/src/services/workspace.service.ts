import { fetchApi } from "./api";

/**
 * The server seeds a single workspace under this id in `bootstrap.ts`.
 * Mirrors `DEFAULT_WORKSPACE_ID` on the server. The frontend exposes it
 * so the open-source onboarding flow can attach the freshly-created
 * user to the workspace without round-tripping a "list workspaces"
 * call (which the membership routes don't expose yet).
 */
export const DEFAULT_WORKSPACE_ID = "default";

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

/**
 * Response shape of `POST /api/v1/users` since the onboarding
 * simplification — the server now returns the user record with a
 * freshly-issued `apiKey` so the dashboard can sign the caller in
 * without a separate key-generation round trip.
 */
export interface CreateUserResult extends User {
  apiKey: string;
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

  listUsers(): Promise<{ items: User[] }> {
    return fetchApi("/api/v1/users");
  },

  getUser(userId: string): Promise<User> {
    return fetchApi(`/api/v1/users/${userId}`);
  },

  getCurrentUser(): Promise<User> {
    return fetchApi("/api/v1/users/me", { skipWorkspace: true });
  },

  createUser(data: CreateUserInput): Promise<CreateUserResult> {
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
    return fetchApi(`/api/v1/users/${userId}/memberships`, {
      skipWorkspace: true,
    });
  },

  generateApiKey(userId: string): Promise<{ apiKey: string }> {
    return fetchApi(`/api/v1/users/${userId}/api-key`, { method: "POST" });
  },

  /**
   * Unauthenticated key recovery. Only succeeds for emails the server
   * allowlists via `LUMINA_ROTATE_KEY_EMAILS`; every other email (and
   * unknown users) comes back as a 404, so the UI must treat failure
   * generically rather than confirming whether an email exists.
   */
  rotateKeyByEmail(email: string): Promise<{ apiKey: string }> {
    return fetchApi(`/api/v1/users/${encodeURIComponent(email)}/rotate-key`, {
      method: "POST",
    });
  },
};
