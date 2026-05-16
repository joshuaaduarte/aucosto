ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "financeVisible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "appLockEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "appLockPinHash" TEXT,
  ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "demoOwnerId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_demoOwnerId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_demoOwnerId_fkey"
      FOREIGN KEY ("demoOwnerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_demoOwnerId_key" ON "User"("demoOwnerId");
