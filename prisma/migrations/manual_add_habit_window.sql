-- Flexible Habit Windows: optional start/end-of-window times for a habit.
--
-- Two nullable HH:MM TEXT columns on Habit. `windowStart` is the earliest a
-- habit can begin, `windowEnd` the latest it should end; the existing
-- `reminderTime` (+ defaultDurationMinutes) remains the preferred slot inside
-- that window. Both columns are optional — a habit with no window behaves
-- exactly as before.
--
-- This file is the idempotent fallback. The same DDL is applied automatically
-- at runtime by ensureHabitWindowColumns() (src/lib/services/habits/shared.ts),
-- which runs on the first habit read after deploy. To apply manually against
-- DIRECT_URL (session pooler) instead:
--
--   npx prisma db execute --file prisma/migrations/manual_add_habit_window.sql --schema prisma/schema
--
-- It is safe to run repeatedly.

ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "windowStart" TEXT;
ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "windowEnd" TEXT;
