CREATE TABLE "FinanceConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "institutionId" TEXT,
  "institutionName" TEXT,
  "accessTokenEnc" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "disconnectedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinanceConnection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FinanceAccount"
ADD COLUMN "connectionId" TEXT,
ADD COLUMN "externalId" TEXT,
ADD COLUMN "syncSource" TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE "FinanceTransaction"
ADD COLUMN "financeAccountId" TEXT,
ADD COLUMN "externalId" TEXT,
ADD COLUMN "syncSource" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "postedStatus" TEXT,
ADD COLUMN "providerCategory" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "FinanceConnection_userId_status_idx" ON "FinanceConnection"("userId", "status");
CREATE UNIQUE INDEX "FinanceConnection_userId_provider_enrollmentId_key" ON "FinanceConnection"("userId", "provider", "enrollmentId");

CREATE INDEX "FinanceAccount_connectionId_idx" ON "FinanceAccount"("connectionId");
CREATE UNIQUE INDEX "FinanceAccount_userId_externalId_key" ON "FinanceAccount"("userId", "externalId");

CREATE INDEX "FinanceTransaction_financeAccountId_date_idx" ON "FinanceTransaction"("financeAccountId", "date");
CREATE UNIQUE INDEX "FinanceTransaction_userId_externalId_key" ON "FinanceTransaction"("userId", "externalId");

ALTER TABLE "FinanceConnection"
ADD CONSTRAINT "FinanceConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceAccount"
ADD CONSTRAINT "FinanceAccount_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "FinanceConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceTransaction"
ADD CONSTRAINT "FinanceTransaction_financeAccountId_fkey"
FOREIGN KEY ("financeAccountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
