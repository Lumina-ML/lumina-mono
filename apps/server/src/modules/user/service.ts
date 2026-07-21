import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { TOKENS } from "../../core/di/tokens.js";
import type { CreateUserInput, UpdateUserInput, GenerateApiKeyInput } from "./schema.js";
import { UserRepository } from "./repository.js";

export interface CreateUserResult {
  user: Awaited<ReturnType<UserRepository["createUser"]>>;
  apiKey: string;
}

@injectable()
export class UserService {
  private readonly repository: UserRepository;

  // Prisma is held but unused now that workspace setup is owned by the
  // onboarding flow. Kept on the constructor so callers (the Fastify
  // route registration) don't have to change.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(@inject(TOKENS.PrismaClient) private readonly prisma: PrismaClient) {
    this.repository = new UserRepository(prisma);
  }

  /**
   * Create a user and mint an API key. Returns both so the open-source
   * onboarding flow can hand the key to the caller in one round trip.
   *
   * Workspace membership is intentionally NOT created here — that's the
   * responsibility of the onboarding caller (see `LoginPage.vue`). This
   * keeps the user module ignorant of workspace concerns and lets the
   * dashboard decide which workspace + role fits the situation (owner
   * for the very first admin, member for everyone added later).
   */
  async createUser(data: CreateUserInput): Promise<CreateUserResult> {
    const apiKey = this.repository.generateApiKey();
    const user = await this.repository.createUser({ ...data, apiKey });
    return { user, apiKey };
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }

  async findByEmail(email: string) {
    return this.repository.findByEmail(email);
  }

  async findByApiKey(apiKey: string) {
    return this.repository.findByApiKey(apiKey);
  }

  async listUsers() {
    return this.repository.listUsers();
  }

  async updateUser(id: string, data: UpdateUserInput) {
    return this.repository.updateUser(id, data);
  }

  async deleteUser(id: string) {
    return this.repository.deleteUser(id);
  }

  async setApiKey(id: string, data: GenerateApiKeyInput) {
    return this.repository.setApiKey(id, data);
  }

  /**
   * Mint a fresh key for the user with this email and return it. Returns
   * null when no such user exists so the caller can respond identically to
   * an allowlist miss (never leak whether an email is registered).
   */
  async rotateApiKeyByEmail(email: string): Promise<{ apiKey: string } | null> {
    const user = await this.repository.findByEmail(email);
    if (!user) return null;
    const apiKey = this.repository.generateApiKey();
    await this.repository.setApiKey(user.id, { apiKey });
    return { apiKey };
  }

  generateApiKey() {
    return this.repository.generateApiKey();
  }
}
