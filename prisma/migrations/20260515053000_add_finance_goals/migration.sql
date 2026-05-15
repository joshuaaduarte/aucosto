CREATE TABLE "FinanceGoal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "owner" TEXT NOT NULL DEFAULT 'shared',
  "category" TEXT NOT NULL DEFAULT 'general',
  "targetAmountCents" INTEGER NOT NULL,
  "currentAmountCents" INTEGER NOT NULL DEFAULT 0,
  "targetDate" TIMESTAMP(3),
  "monthlyContributionCents" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinanceGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceGoal_userId_status_idx" ON "FinanceGoal"("userId", "status");
CREATE UNIQUE INDEX "FinanceGoal_userId_name_key" ON "FinanceGoal"("userId", "name");

ALTER TABLE "FinanceGoal"
ADD CONSTRAINT "FinanceGoal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
