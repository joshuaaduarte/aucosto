CREATE TABLE IF NOT EXISTS "CalendarItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'block',
  "status" TEXT NOT NULL DEFAULT 'confirmed',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "sourceTool" TEXT,
  "sourceRefId" TEXT,
  "notes" TEXT,
  "location" TEXT,
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarItem_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CalendarItem_userId_fkey'
  ) THEN
    ALTER TABLE "CalendarItem"
      ADD CONSTRAINT "CalendarItem_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CalendarItem_userId_startsAt_idx" ON "CalendarItem"("userId", "startsAt");
CREATE INDEX IF NOT EXISTS "CalendarItem_userId_status_startsAt_idx" ON "CalendarItem"("userId", "status", "startsAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarItem_userId_externalId_key" ON "CalendarItem"("userId", "externalId");
