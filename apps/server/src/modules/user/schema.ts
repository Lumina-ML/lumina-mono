import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(256).optional(),
  avatar: z.string().max(2048).optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  avatar: z.string().max(2048).optional(),
});

export const GenerateApiKeySchema = z.object({
  apiKey: z.string().min(8).max(256),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type GenerateApiKeyInput = z.infer<typeof GenerateApiKeySchema>;
