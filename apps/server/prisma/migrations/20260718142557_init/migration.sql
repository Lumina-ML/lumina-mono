-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "value" DOUBLE PRECISION NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Run_project_createdAt_idx" ON "Run"("project", "createdAt");

-- CreateIndex
CREATE INDEX "Run_status_idx" ON "Run"("status");

-- CreateIndex
CREATE INDEX "Metric_runId_key_step_idx" ON "Metric"("runId", "key", "step");

-- CreateIndex
CREATE INDEX "Metric_runId_loggedAt_idx" ON "Metric"("runId", "loggedAt");

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
