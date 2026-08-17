ALTER TABLE "CalendarItem"
ADD COLUMN IF NOT EXISTS "recurrenceRule" JSONB,
ADD COLUMN IF NOT EXISTS "recurrenceParentId" TEXT,
ADD COLUMN IF NOT EXISTS "recurrenceOriginalStart" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CalendarItem_userId_recurrenceParentId_recurrenceOriginalStart_idx"
ON "CalendarItem"("userId", "recurrenceParentId", "recurrenceOriginalStart");
