-- Idempotent DDL for finance tracking: balance history (net worth chart),
-- statement checks, and per-account projection settings
-- (prisma/schema/finance.prisma: FinanceBalanceSnapshot,
-- FinanceStatementCheck, FinanceAccountPlan).
-- Apply over DIRECT_URL (session pooler); `prisma migrate dev` would demand
-- a reset (see CLAUDE.md):
--   1. npx tsx --env-file=.env scripts/apply-sql.ts scripts/create-finance-tracking.sql
--   2. npm run db:generate
-- Adds no columns to existing tables. Until it runs, quick add, pacing and
-- budgets work; net worth history, statement checks and projection settings
-- show a "finish setup" note instead. Safe to re-run. Generated from
-- `prisma migrate diff`, so names match a future reconciled migration.

CREATE TABLE IF NOT EXISTS "FinanceBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financeAccountId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinanceStatementCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financeAccountId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalanceCents" INTEGER NOT NULL,
    "closingBalanceCents" INTEGER NOT NULL,
    "adjustmentCents" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "addedCount" INTEGER NOT NULL DEFAULT 0,
    "checkedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceStatementCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinanceAccountPlan" (
    "financeAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyContributionCents" INTEGER NOT NULL DEFAULT 0,
    "annualGrowthBps" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccountPlan_pkey" PRIMARY KEY ("financeAccountId")
);

CREATE INDEX IF NOT EXISTS "FinanceBalanceSnapshot_userId_asOf_idx" ON "FinanceBalanceSnapshot"("userId", "asOf");
CREATE INDEX IF NOT EXISTS "FinanceBalanceSnapshot_financeAccountId_asOf_idx" ON "FinanceBalanceSnapshot"("financeAccountId", "asOf");
CREATE INDEX IF NOT EXISTS "FinanceStatementCheck_financeAccountId_periodEnd_idx" ON "FinanceStatementCheck"("financeAccountId", "periodEnd");
CREATE INDEX IF NOT EXISTS "FinanceStatementCheck_userId_createdAt_idx" ON "FinanceStatementCheck"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "FinanceAccountPlan_userId_idx" ON "FinanceAccountPlan"("userId");

DO $$ BEGIN ALTER TABLE "FinanceBalanceSnapshot" ADD CONSTRAINT "FinanceBalanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "FinanceBalanceSnapshot" ADD CONSTRAINT "FinanceBalanceSnapshot_financeAccountId_fkey" FOREIGN KEY ("financeAccountId") REFERENCES "FinanceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "FinanceStatementCheck" ADD CONSTRAINT "FinanceStatementCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "FinanceStatementCheck" ADD CONSTRAINT "FinanceStatementCheck_financeAccountId_fkey" FOREIGN KEY ("financeAccountId") REFERENCES "FinanceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "FinanceAccountPlan" ADD CONSTRAINT "FinanceAccountPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "FinanceAccountPlan" ADD CONSTRAINT "FinanceAccountPlan_financeAccountId_fkey" FOREIGN KEY ("financeAccountId") REFERENCES "FinanceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed one snapshot per account from today's balances so the net worth
-- chart has a starting point. Skips accounts that already have one.
INSERT INTO "FinanceBalanceSnapshot" ("id", "userId", "financeAccountId", "balanceCents", "asOf", "source")
SELECT 'seed_' || a."id", a."userId", a."id", a."currentBalanceCents", a."balanceUpdatedAt", 'manual'
FROM "FinanceAccount" a
WHERE NOT EXISTS (SELECT 1 FROM "FinanceBalanceSnapshot" s WHERE s."financeAccountId" = a."id");
