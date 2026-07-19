-- Add columns needed for content-addressed dedup, manifest, and reference
-- artifact support.

-- AlterTable: ArtifactVersion gains `digest` (sha256 of manifest) and
-- `manifest` (JSON snapshot of all file entries).
ALTER TABLE "ArtifactVersion"
  ADD COLUMN "digest" TEXT,
  ADD COLUMN "manifest" JSONB;

-- AlterTable: ArtifactFile gains content-addressed fields. `storageKey` is
-- now optional (null for reference artifacts which use `referenceUri`).
ALTER TABLE "ArtifactFile"
  ADD COLUMN "sha256" TEXT,
  ADD COLUMN "etag" TEXT,
  ADD COLUMN "referenceUri" TEXT,
  ADD COLUMN "contentType" TEXT,
  ALTER COLUMN "storageKey" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ArtifactFile_artifactVersionId_sha256_idx"
  ON "ArtifactFile"("artifactVersionId", "sha256");