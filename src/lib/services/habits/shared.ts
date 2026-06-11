// Internal types shared between habit service modules. Not exported from the
// barrel — keep these out of public callsites.

import "server-only";
import type { Habit, HabitEntry, TimeEntry } from "@/generated/prisma/client";

export type HabitWithRelations = Habit & {
  entries: HabitEntry[];
  timeEntries: TimeEntry[];
};

export type HabitEntryMode = "full" | "fallback" | "recovery";
