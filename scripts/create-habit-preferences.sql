-- Idempotent DDL for HabitPreference (prisma/schema/habits.prisma): per-habit
-- settings added for the calendar/time/habits plan, kept out of the Habit
-- table so every existing Habit query keeps working before this runs.
--   healthMetric  Apple Health measure that fills the habit (steps, workouts…)
--   focus         'focus' | 'later' | NULL (NULL = not chosen yet)
--   cue           "after…" anchor shown on the habit ("after coffee")
-- Apply with DIRECT_URL:
--   npx tsx --env-file=.env scripts/apply-sql.ts scripts/create-habit-preferences.sql
-- Until it runs, habits behave exactly as before and the new controls say so.

CREATE TABLE IF NOT EXISTS "HabitPreference" (
  "habitId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "healthMetric" TEXT,
  "focus" TEXT,
  "cue" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HabitPreference_pkey" PRIMARY KEY ("habitId"),
  CONSTRAINT "HabitPreference_habitId_fkey" FOREIGN KEY ("habitId")
    REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HabitPreference_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "HabitPreference_userId_idx" ON "HabitPreference"("userId");
