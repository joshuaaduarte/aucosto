-- Idempotent DDL for remembered shop rules (prisma/schema/finance.prisma:
-- FinanceShopRule). Apply over DIRECT_URL (session pooler); `prisma migrate
-- dev` would demand a reset (see CLAUDE.md):
--   1. npx tsx --env-file=.env scripts/apply-sql.ts scripts/create-finance-shop-rules.sql
--   2. npm run db:generate
-- Adds no columns to existing tables. Until it runs, finance works as before:
-- rules are read as none and saving one is skipped. Safe to re-run.
-- Generated from `prisma migrate diff`, so names match a future migration.

CREATE TABLE IF NOT EXISTS "FinanceShopRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "match" TEXT NOT NULL,
    "name" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceShopRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FinanceShopRule_userId_idx" ON "FinanceShopRule"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceShopRule_userId_ownerUserId_match_key"
    ON "FinanceShopRule"("userId", "ownerUserId", "match");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceShopRule_userId_fkey') THEN
        ALTER TABLE "FinanceShopRule" ADD CONSTRAINT "FinanceShopRule_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
