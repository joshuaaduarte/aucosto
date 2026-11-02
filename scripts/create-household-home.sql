-- Idempotent DDL for the household (shared access), home tool, and finance
-- budgets/bills tables: prisma/schema/{household,home,finance}.prisma.
-- Apply over DIRECT_URL (session pooler) BEFORE deploying the code that reads
-- them, because `prisma migrate dev` would demand a reset (see CLAUDE.md):
--   1. npx tsx --env-file=.env scripts/apply-sql.ts scripts/create-household-home.sql
--   2. npm run db:generate
-- Foreign keys are wrapped in one-line DO blocks so re-runs skip them
-- (apply-sql.ts splits on end-of-line semicolons). Safe to re-run. Generated from `prisma migrate diff`, so names match what
-- a future reconciled migration would create. Adds no columns to existing
-- tables: if this hasn't run, login and personal tools keep working and the
-- household/home features stay hidden.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Our home',
    "dataUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HouseholdMember" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HouseholdInvite" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinanceBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "monthlyLimitCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinanceBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER,
    "cadence" TEXT NOT NULL DEFAULT 'monthly',
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "autopay" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lastPaidAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HomeList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HomeListItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "checkedAt" TIMESTAMP(3),
    "addedByUserId" TEXT,
    "checkedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HomeTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'chore',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "cadenceDays" INTEGER NOT NULL,
    "assigneeUserId" TEXT,
    "rotate" BOOLEAN NOT NULL DEFAULT false,
    "lastDoneAt" TIMESTAMP(3),
    "lastDoneByUserId" TEXT,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceBudget_userId_category_key" ON "FinanceBudget"("userId", "category");
CREATE INDEX IF NOT EXISTS "FinanceBill_userId_archivedAt_nextDueAt_idx" ON "FinanceBill"("userId", "archivedAt", "nextDueAt");
CREATE INDEX IF NOT EXISTS "HomeList_userId_sortOrder_idx" ON "HomeList"("userId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "HomeList_userId_name_key" ON "HomeList"("userId", "name");
CREATE INDEX IF NOT EXISTS "HomeListItem_listId_checkedAt_idx" ON "HomeListItem"("listId", "checkedAt");
CREATE INDEX IF NOT EXISTS "HomeListItem_userId_idx" ON "HomeListItem"("userId");
CREATE INDEX IF NOT EXISTS "HomeTask_userId_archivedAt_nextDueAt_idx" ON "HomeTask"("userId", "archivedAt", "nextDueAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Household_dataUserId_key" ON "Household"("dataUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "HouseholdMember_userId_key" ON "HouseholdMember"("userId");
CREATE INDEX IF NOT EXISTS "HouseholdMember_householdId_idx" ON "HouseholdMember"("householdId");
CREATE UNIQUE INDEX IF NOT EXISTS "HouseholdInvite_tokenHash_key" ON "HouseholdInvite"("tokenHash");
CREATE INDEX IF NOT EXISTS "HouseholdInvite_householdId_email_idx" ON "HouseholdInvite"("householdId", "email");

DO $$ BEGIN ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "FinanceBill" ADD CONSTRAINT "FinanceBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HomeList" ADD CONSTRAINT "HomeList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HomeListItem" ADD CONSTRAINT "HomeListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "HomeList"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HomeTask" ADD CONSTRAINT "HomeTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Household" ADD CONSTRAINT "Household_dataUserId_fkey" FOREIGN KEY ("dataUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
