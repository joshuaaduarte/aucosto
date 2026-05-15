CREATE TABLE "FinanceAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "currentBalanceCents" INTEGER NOT NULL,
  "balanceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "statementBalanceCents" INTEGER,
  "dueDate" TIMESTAMP(3),
  "creditLimitCents" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceAccount_userId_kind_idx" ON "FinanceAccount"("userId", "kind");
CREATE UNIQUE INDEX "FinanceAccount_userId_name_key" ON "FinanceAccount"("userId", "name");

ALTER TABLE "FinanceAccount"
ADD CONSTRAINT "FinanceAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
