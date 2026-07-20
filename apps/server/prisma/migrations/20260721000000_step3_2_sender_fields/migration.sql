-- Step 3.2 sender.py rewrite — adds the run-side fields and tables the
-- rewired SendManager needs.
--
-- Scope:
--   * Run.telemetry      (Json)  — wandb TelemetryRecord envelope
--   * Run.metricDefs     (Json)  — wandb MetricRecord definitions
--   * RunAlert           (table) — wandb notify_scriptable_run_alert
--   * RunUseArtifact     (table) — wandb UseArtifact mutation
--   * ArtifactPortfolioLink (table) — wandb LinkArtifact mutation
--
-- The first two fold into the existing PATCH /api/v1/runs/:id route (via
-- UpdateRunSchema) so no new route module is needed for them. The three
-- new tables each get their own route module in step 3.2 A.4.

-- AlterTable: Run gains telemetry + metricDefs JSON envelopes.
ALTER TABLE "Run"
  ADD COLUMN "telemetry" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "metricDefs" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- CreateTable: RunAlert
CREATE TABLE "RunAlert" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RunUseArtifact
CREATE TABLE "RunUseArtifact" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "artifactVersionId" TEXT NOT NULL,
    "useType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunUseArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ArtifactPortfolioLink
CREATE TABLE "ArtifactPortfolioLink" (
    "id" TEXT NOT NULL,
    "artifactVersionId" TEXT NOT NULL,
    "portfolioName" TEXT NOT NULL,
    "portfolioEntity" TEXT,
    "portfolioProject" TEXT NOT NULL,
    "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "versionIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtifactPortfolioLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunAlert_runId_createdAt_idx" ON "RunAlert"("runId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RunUseArtifact_runId_artifactVersionId_useType_key"
  ON "RunUseArtifact"("runId", "artifactVersionId", "useType");
CREATE INDEX "RunUseArtifact_artifactVersionId_idx"
  ON "RunUseArtifact"("artifactVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactPortfolioLink_artifactVersionId_portfolioProject_portfolioName_key"
  ON "ArtifactPortfolioLink"("artifactVersionId", "portfolioProject", "portfolioName");
CREATE INDEX "ArtifactPortfolioLink_portfolioProject_portfolioName_idx"
  ON "ArtifactPortfolioLink"("portfolioProject", "portfolioName");

-- AddForeignKey: RunAlert → Run
ALTER TABLE "RunAlert"
  ADD CONSTRAINT "RunAlert_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "Run"("runId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: RunUseArtifact → Run
ALTER TABLE "RunUseArtifact"
  ADD CONSTRAINT "RunUseArtifact_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "Run"("runId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: RunUseArtifact → ArtifactVersion
ALTER TABLE "RunUseArtifact"
  ADD CONSTRAINT "RunUseArtifact_artifactVersionId_fkey"
  FOREIGN KEY ("artifactVersionId") REFERENCES "ArtifactVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ArtifactPortfolioLink → ArtifactVersion
ALTER TABLE "ArtifactPortfolioLink"
  ADD CONSTRAINT "ArtifactPortfolioLink_artifactVersionId_fkey"
  FOREIGN KEY ("artifactVersionId") REFERENCES "ArtifactVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;