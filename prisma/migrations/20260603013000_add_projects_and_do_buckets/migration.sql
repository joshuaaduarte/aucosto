CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "bucket" TEXT,
  "summary" TEXT,
  "nextMilestone" TEXT,
  "targetDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Project_userId_fkey'
  ) THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT "Project_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "DoItem" ADD COLUMN IF NOT EXISTS "bucket" TEXT;
ALTER TABLE "DoItem" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DoItem_projectId_fkey'
  ) THEN
    ALTER TABLE "DoItem"
      ADD CONSTRAINT "DoItem_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Project_userId_status_updatedAt_idx" ON "Project"("userId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Project_userId_targetDate_idx" ON "Project"("userId", "targetDate");
CREATE INDEX IF NOT EXISTS "DoItem_userId_bucket_updatedAt_idx" ON "DoItem"("userId", "bucket", "updatedAt");
CREATE INDEX IF NOT EXISTS "DoItem_projectId_status_updatedAt_idx" ON "DoItem"("projectId", "status", "updatedAt");
