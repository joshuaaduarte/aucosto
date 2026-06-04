ALTER TABLE "Habit"
ADD COLUMN "fallbackTitle" TEXT,
ADD COLUMN "rescuePrompt" TEXT;

ALTER TABLE "HabitEntry"
ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'full';
