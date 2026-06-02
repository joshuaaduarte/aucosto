CREATE TABLE IF NOT EXISTS "DoItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "lane" TEXT NOT NULL DEFAULT 'next',
  "status" TEXT NOT NULL DEFAULT 'open',
  "estimatedMinutes" INTEGER,
  "actualMinutes" INTEGER,
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "lastWorkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DoItem_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DoItem_userId_fkey'
  ) THEN
    ALTER TABLE "DoItem"
      ADD CONSTRAINT "DoItem_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "doItemId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TimeEntry_doItemId_fkey'
  ) THEN
    ALTER TABLE "TimeEntry"
      ADD CONSTRAINT "TimeEntry_doItemId_fkey"
      FOREIGN KEY ("doItemId") REFERENCES "DoItem"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DoItem_userId_status_lane_createdAt_idx" ON "DoItem"("userId", "status", "lane", "createdAt");
CREATE INDEX IF NOT EXISTS "DoItem_userId_completedAt_idx" ON "DoItem"("userId", "completedAt");
CREATE INDEX IF NOT EXISTS "TimeEntry_doItemId_startedAt_idx" ON "TimeEntry"("doItemId", "startedAt");
