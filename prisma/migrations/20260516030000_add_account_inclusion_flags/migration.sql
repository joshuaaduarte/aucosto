ALTER TABLE "FinanceAccount"
  ADD COLUMN "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "includeInCashPosition" BOOLEAN NOT NULL DEFAULT false;

UPDATE "FinanceAccount"
SET "includeInCashPosition" = CASE
  WHEN kind IN ('checking', 'savings', 'cash') THEN true
  ELSE false
END,
"includeInNetWorth" = true;
