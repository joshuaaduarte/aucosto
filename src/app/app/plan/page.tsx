import Link from "next/link";
import {
  defaultSlotsForDay,
  resolvePlanMode,
  startOfDay,
} from "@/lib/day-plan";
import { listPlannedBlocks } from "@/lib/services/day-plan";
import { getRunningEntry } from "@/lib/services/time";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { ConfirmList, type ConfirmBlock } from "./confirm-list";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";

// The plan screen has exactly two jobs, and which one it shows is decided by
// the data and the clock, never by a tab: if today already has a plan, confirm
// it; if the day still has runway, shape today; otherwise shape tomorrow.
// Both push nudges deep-link straight here.

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function PlanPage() {
  const userId = await resolveActiveUserId();
  const now = new Date();

  const todayBlocks = await listPlannedBlocks(userId, startOfDay(now));
  const mode = resolvePlanMode({ now, hasPlanToday: todayBlocks.length > 0 });

  const [targetBlocks, running] = await Promise.all([
    mode.kind === "plan" && mode.dayOffset === 1
      ? listPlannedBlocks(userId, startOfDay(now, 1))
      : Promise.resolve(todayBlocks),
    getRunningEntry(userId),
  ]);

  const confirmBlocks: ConfirmBlock[] = todayBlocks
    .slice()
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((block) => ({
      id: block.id,
      title: block.title,
      timeLabel: timeLabel(block.startsAt),
      confirmed: block.confirmed,
    }));

  const targetDay = startOfDay(now, mode.dayOffset);
  const dayName =
    mode.dayOffset === 0
      ? "today"
      : targetDay.toLocaleDateString("en-US", { weekday: "long" });

  const eyebrow =
    mode.kind === "confirm"
      ? "Today's plan"
      : mode.dayOffset === 0
        ? "Shape the day"
        : "Tonight";

  const heading =
    mode.kind === "confirm"
      ? "Here's the day"
      : mode.dayOffset === 0
        ? "What matters today?"
        : `Plan ${dayName}`;

  const lede =
    mode.kind === "confirm"
      ? "You set these already. Confirm them, or start one now."
      : "Two or three blocks is enough. Naming when you'll do something is most of what makes it happen.";

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-1 py-2">
      <header className="space-y-1">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          {eyebrow}
        </p>
        <h1
          className="text-[1.375rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          {heading}
        </h1>
        <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          {lede}
        </p>
      </header>

      {mode.kind === "confirm" ? (
        <ConfirmList
          blocks={confirmBlocks}
          runningLabel={running?.label ?? null}
        />
      ) : (
        <PlanForm
          target={mode.dayOffset === 0 ? "today" : "tomorrow"}
          slots={defaultSlotsForDay({ now, dayOffset: mode.dayOffset })}
          initial={targetBlocks
            .slice()
            .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
            .map((block) => ({
              title: block.title,
              startHour: block.startsAt.getHours(),
              durationMinutes: Math.max(
                5,
                Math.round(
                  (block.endsAt.getTime() - block.startsAt.getTime()) / 60000,
                ),
              ),
            }))}
        />
      )}

      <div className="pt-2">
        <Link
          href="/app"
          className="text-[0.8125rem] font-medium"
          style={{ color: "var(--text-faint)" }}
        >
          ← Back to today
        </Link>
      </div>
    </div>
  );
}
