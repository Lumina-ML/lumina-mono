import type { PrismaClient } from "../../generated/prisma/index.js";
import type { LinkArtifactInput } from "./schema.js";

export class ArtifactLinkService {
  constructor(private readonly prisma: PrismaClient) {}

  async link(versionId: string, data: LinkArtifactInput) {
    // Compute the next version index within this portfolio — the row is
    // keyed by (artifactVersionId, portfolioProject, portfolioName), so we
    // can't reuse the wandb convention of "index by portfolio" exactly,
    // but a per-portfolio running counter is what callers expect.
    const siblings = await this.prisma.artifactPortfolioLink.findMany({
      where: {
        portfolioProject: data.portfolioProject,
        portfolioName: data.portfolioName,
      },
      orderBy: { versionIndex: "desc" },
      take: 1,
      select: { versionIndex: true },
    });
    const versionIndex =
      (siblings.length === 1 ? siblings[0]!.versionIndex : -1) + 1;

    const row = await this.prisma.artifactPortfolioLink.create({
      data: {
        artifactVersionId: versionId,
        portfolioName: data.portfolioName,
        portfolioProject: data.portfolioProject,
        portfolioEntity: data.portfolioEntity ?? null,
        aliases: data.aliases ?? [],
        versionIndex,
      },
    });

    return row;
  }
}