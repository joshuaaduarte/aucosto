-- Fallback: create the DailyReflection table directly, bypassing Prisma
-- migrate. Idempotent — safe to run repeatedly.
--
-- How to run (either works):
--   1. psql "$DIRECT_URL" -f scripts/create-reflect-table.sql
--   2. Paste into the Supabase SQL editor and run.
--
-- IMPORTANT — after this succeeds, tell Prisma the migration is applied so
-- future `npm run db:migrate` runs don't try to re-create the table:
--   npx prisma migrate resolve --applied 20260612090000_add_daily_reflection
-- and regenerate the typed client:
--   npm run db:generate
--
-- Then verify with:
--   npx tsx --env-file=.env scripts/check-reflect.ts

CREATE TABLE IF NOT EXISTS "DailyReflection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mood" INTEGER NOT NULL,
    "energyLevel" INTEGER NOT NULL,
    "productivityRating" INTEGER NOT NULL,
    "dayRating" INTEGER NOT NULL,
    "wentWell" TEXT,
    "carryForward" TEXT,
    "freeNotes" TEXT,
    "contextSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReflection_pkey" PRIMARY KEY ("id")
);

-- Unique per user per day — the save-upsert's ON CONFLICT target.
CREATE UNIQUE INDEX IF NOT EXISTS "DailyReflection_userId_date_key"
    ON "DailyReflection"("userId", "date");

-- FK to User, guarded because ADD CONSTRAINT has no IF NOT EXISTS.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DailyReflection_userId_fkey'
    ) THEN
        ALTER TABLE "DailyReflection"
            ADD CONSTRAINT "DailyReflection_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
