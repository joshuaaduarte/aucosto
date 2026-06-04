ALTER TABLE "DoItem" ADD COLUMN "habitId" TEXT;

CREATE INDEX "DoItem_habitId_status_updatedAt_idx" ON "DoItem"("habitId", "status", "updatedAt");

ALTER TABLE "DoItem"
ADD CONSTRAINT "DoItem_habitId_fkey"
FOREIGN KEY ("habitId") REFERENCES "Habit"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
