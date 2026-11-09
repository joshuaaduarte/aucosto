-- Idempotent DDL for CalendarFeed (prisma/schema/calendar.prisma): read-only
-- iCal feeds from Google Calendar / Outlook. Apply with DIRECT_URL:
--   npx tsx --env-file=.env scripts/apply-sql.ts scripts/create-calendar-feeds.sql
-- then `npm run db:generate`. Names match what `prisma migrate` would generate.
-- Until this runs, Settings shows the feed panel as "not set up yet" and the
-- calendar works exactly as before.

CREATE TABLE IF NOT EXISTS "CalendarFeed" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "urlEncrypted" TEXT NOT NULL,
  "urlHost" TEXT NOT NULL,
  "color" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "eventCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarFeed_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarFeed_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CalendarFeed_userId_idx" ON "CalendarFeed"("userId");
