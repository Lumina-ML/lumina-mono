-- CreateEnum
CREATE TYPE "LaunchRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "LaunchQueue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "command" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "args" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "env" JSONB NOT NULL DEFAULT '{}',
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "runId" TEXT,
    "status" "LaunchRunStatus" NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaunchQueue_projectId_createdAt_idx" ON "LaunchQueue"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchQueue_projectId_name_key" ON "LaunchQueue"("projectId", "name");

-- CreateIndex
CREATE INDEX "LaunchJob_projectId_createdAt_idx" ON "LaunchJob"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchJob_projectId_name_key" ON "LaunchJob"("projectId", "name");

-- CreateIndex
CREATE INDEX "LaunchRun_queueId_status_createdAt_idx" ON "LaunchRun"("queueId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LaunchRun_projectId_createdAt_idx" ON "LaunchRun"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "LaunchQueue" ADD CONSTRAINT "LaunchQueue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchJob" ADD CONSTRAINT "LaunchJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchRun" ADD CONSTRAINT "LaunchRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchRun" ADD CONSTRAINT "LaunchRun_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "LaunchQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchRun" ADD CONSTRAINT "LaunchRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LaunchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchRun" ADD CONSTRAINT "LaunchRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("runId") ON DELETE SET NULL ON UPDATE CASCADE;

