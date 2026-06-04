ALTER TABLE "Habit"
ADD COLUMN "dayPart" TEXT NOT NULL DEFAULT 'anytime';

UPDATE "Habit"
SET "dayPart" = CASE
  WHEN "reminderTime" IS NULL OR trim("reminderTime") = '' THEN 'anytime'
  WHEN "reminderTime" >= '04:00' AND "reminderTime" < '11:00' THEN 'morning'
  WHEN "reminderTime" >= '11:00' AND "reminderTime" < '17:00' THEN 'day'
  WHEN "reminderTime" >= '17:00' THEN 'evening'
  ELSE 'anytime'
END;
