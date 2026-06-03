CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bucket" TEXT,
    "notes" TEXT,
    "cadence" TEXT NOT NULL DEFAULT 'daily',
    "daysOfWeek" TEXT,
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "goalUnit" TEXT NOT NULL DEFAULT 'check',
    "defaultDurationMinutes" INTEGER,
    "reminderTime" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HabitEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TimeEntry" ADD COLUMN "habitId" TEXT;

CREATE INDEX "Habit_userId_archivedAt_updatedAt_idx" ON "Habit"("userId", "archivedAt", "updatedAt");
CREATE INDEX "Habit_userId_cadence_updatedAt_idx" ON "Habit"("userId", "cadence", "updatedAt");
CREATE INDEX "Habit_userId_bucket_updatedAt_idx" ON "Habit"("userId", "bucket", "updatedAt");

CREATE INDEX "HabitEntry_userId_loggedAt_idx" ON "HabitEntry"("userId", "loggedAt");
CREATE INDEX "HabitEntry_habitId_loggedAt_idx" ON "HabitEntry"("habitId", "loggedAt");
CREATE INDEX "TimeEntry_habitId_startedAt_idx" ON "TimeEntry"("habitId", "startedAt");

ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HabitEntry" ADD CONSTRAINT "HabitEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HabitEntry" ADD CONSTRAINT "HabitEntry_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
