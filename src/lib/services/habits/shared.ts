// Internal types shared between habit service modules. Not exported from the
// barrel — keep these out of public callsites.

import "server-only";
import { prisma } from "@/lib/prisma";
import type { Habit, HabitEntry, TimeEntry } from "@/generated/prisma/client";

export type HabitWithRelations = Habit & {
  entries: HabitEntry[];
  timeEntries: TimeEntry[];
};

export type HabitEntryMode = "full" | "fallback" | "recovery";

// Flexible-window columns were added without a `prisma migrate` run (it hangs
// in the authoring environment), so the live DB may not have them yet on first
// deploy. This applies the idempotent DDL once per process before any habit
// query that selects those columns runs — the generated client (regenerated
// from schema on every Vercel build) always SELECTs them, so a missing column
// would otherwise throw. `ADD COLUMN IF NOT EXISTS` is a cheap no-op once the
// columns exist. Mirrors prisma/migrations/manual_add_habit_window.sql.
let windowColumnsReady: Promise<void> | null = null;

export function ensureHabitWindowColumns(): Promise<void> {
  if (!windowColumnsReady) {
    windowColumnsReady = prisma
      .$executeRawUnsafe(
        'ALTER TABLE "Habit" ADD COLUMN IF NOT EXISTS "windowStart" TEXT, ADD COLUMN IF NOT EXISTS "windowEnd" TEXT;',
      )
      .then(() => undefined)
      .catch((error) => {
        // Never throw: if the ALTER genuinely fails the subsequent query will
        // surface its own error. Reset the memo so a transient cold-start DB
        // blip retries on the next call instead of poisoning the process.
        windowColumnsReady = null;
        console.error("[habits] ensureHabitWindowColumns failed", error);
      });
  }
  return windowColumnsReady;
}
