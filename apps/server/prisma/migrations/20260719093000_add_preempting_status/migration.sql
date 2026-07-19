-- Add preempting to RunStatus enum so SDK `mark_preempting()` can
-- distinguish an in-flight run that is about to be killed.
ALTER TYPE "RunStatus" ADD VALUE IF NOT EXISTS 'preempting';