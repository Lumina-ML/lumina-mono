-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('table', 'image', 'video', 'audio', 'plotly', 'html', 'file');

-- CreateTable
CREATE TABLE "RunMedia" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "artifactVersionId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunMedia_runId_createdAt_idx" ON "RunMedia"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "RunMedia_projectId_createdAt_idx" ON "RunMedia"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "RunMedia" ADD CONSTRAINT "RunMedia_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("runId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunMedia" ADD CONSTRAINT "RunMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunMedia" ADD CONSTRAINT "RunMedia_artifactVersionId_fkey" FOREIGN KEY ("artifactVersionId") REFERENCES "ArtifactVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

