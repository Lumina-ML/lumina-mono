import { z } from "zod";

export const LinkArtifactSchema = z.object({
  portfolioName: z.string().min(1).max(128),
  portfolioProject: z.string().min(1).max(128),
  portfolioEntity: z.string().min(1).max(128).optional(),
  aliases: z.array(z.string().min(1).max(64)).max(32).optional(),
});

export type LinkArtifactInput = z.infer<typeof LinkArtifactSchema>;