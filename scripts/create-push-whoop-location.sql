-- Idempotent DDL for the PushSubscription, WhoopConnection and LocationEvent
-- tables (prisma/schema/{push,whoop,location}.prisma). Applied manually via
-- DIRECT_URL (session pooler) because the checked-in migration history has
-- diverged from the database and `prisma migrate dev` would demand a reset:
--   1. psql "$DIRECT_URL" -f scripts/create-push-whoop-location.sql
--      (or: npx tsx --env-file=.env scripts/apply-sql.ts scripts/create-push-whoop-location.sql)
--   2. npm run db:generate
-- Names match what `prisma migrate` would generate, so a future reconciled
-- migration can adopt these tables without a diff.

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_userId_endpoint_key"
  ON "PushSubscription"("userId", "endpoint");

CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx"
  ON "PushSubscription"("userId");

CREATE TABLE IF NOT EXISTS "WhoopConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "whoopUserId" TEXT,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "scopes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhoopConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhoopConnection_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhoopConnection_userId_key"
  ON "WhoopConnection"("userId");

CREATE TABLE IF NOT EXISTS "LocationEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "place" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LocationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LocationEvent_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LocationEvent_userId_occurredAt_idx"
  ON "LocationEvent"("userId", "occurredAt");
