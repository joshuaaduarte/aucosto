-- Foundation pass: add User.timezone, rename Transaction -> FinanceTransaction,
-- convert FinanceTransaction.amount from DOUBLE PRECISION to INTEGER (minor
-- units / cents), add FinanceTransaction.currency. Renames preserve data; the
-- amount conversion multiplies by 100 and rounds to integer cents.

-- AlterTable: User gains a timezone column (default UTC)
ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- Rename Transaction -> FinanceTransaction (and its primary key, index, FK)
ALTER TABLE "Transaction" RENAME TO "FinanceTransaction";
ALTER INDEX "Transaction_pkey" RENAME TO "FinanceTransaction_pkey";
ALTER INDEX "Transaction_userId_date_idx" RENAME TO "FinanceTransaction_userId_date_idx";
ALTER TABLE "FinanceTransaction" RENAME CONSTRAINT "Transaction_userId_fkey" TO "FinanceTransaction_userId_fkey";

-- Convert amount: DOUBLE PRECISION (dollars) -> INTEGER (cents). Round to
-- nearest cent so 19.99 -> 1999.
ALTER TABLE "FinanceTransaction"
  ALTER COLUMN "amount" TYPE INTEGER USING (ROUND("amount" * 100))::integer;

-- Currency column (USD default; column is on the row, not the user, so a
-- multi-currency future doesn't need another migration).
ALTER TABLE "FinanceTransaction" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
