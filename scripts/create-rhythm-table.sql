-- Idempotent fallback for the RhythmSession table (Life Rhythms feature).
-- Mirrors prisma/migrations/20260611200000_add_rhythm_sessions. Apply against
-- DIRECT_URL (session pooler) if the checked-in migration is stuck:
--
--   npx prisma db execute --file scripts/create-rhythm-table.sql --schema prisma/schema
--
-- then record it so Prisma stops listing it as pending:
--
--   npx prisma migrate resolve --applied 20260611200000_add_rhythm_sessions

CREATE TABLE IF NOT EXISTS "RhythmSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RhythmSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RhythmSession_userId_startedAt_idx" ON "RhythmSession"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "RhythmSession_userId_type_startedAt_idx" ON "RhythmSession"("userId", "type", "startedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'RhythmSession_userId_fkey'
  ) THEN
    ALTER TABLE "RhythmSession"
      ADD CONSTRAINT "RhythmSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
