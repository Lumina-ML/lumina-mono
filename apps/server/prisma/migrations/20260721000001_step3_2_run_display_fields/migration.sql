-- Step 3.2 sender.py rewrite — adds the run-side identity fields the
-- rewired init flow needs (displayName, group, jobType). All nullable
-- for backward compatibility with existing rows.

ALTER TABLE "Run"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "group" TEXT,
  ADD COLUMN "jobType" TEXT;

CREATE INDEX "Run_projectId_group_idx" ON "Run"("projectId", "group");