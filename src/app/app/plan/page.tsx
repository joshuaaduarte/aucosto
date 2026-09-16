import Link from "next/link";
import { startOfDay } from "@/lib/day-plan";
import { listPlannedBlocks } from "@/lib/services/day-plan";
import { getRunningEntry } from "@/lib/services/time";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { ConfirmList, type ConfirmBlock } from "./confirm-list";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";

// The plan screen has exactly two jobs, and which one it shows is decided by
// the data, not by a tab: if today already has a plan, confirm it; otherwise
// write tomorrow's. Both push nudges deep-link straight here.

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function PlanPage() {
  const userId = await resolveActiveUserId();
  const now = new Date();

  const [todayBlocks, tomorrowBlocks, running] = await Promise.all([
    listPlannedBlocks(userId, startOfDay(now)),
    listPlannedBlocks(userId, startOfDay(now, 1)),
    getRunningEntry(userId),
  ]);

  const mode = todayBlocks.length > 0 ? "confirm" : "plan";

  const confirmBlocks: ConfirmBlock[] = todayBlocks
    .slice()
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((block) => ({
      id: block.id,
      title: block.title,
      timeLabel: timeLabel(block.startsAt),
      confirmed: block.confirmed,
    }));

  const tomorrowLabel = startOfDay(now, 1).toLocaleDateString("en-US", {
    weekday: "long",
  });

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-1 py-2">
      <header className="space-y-1">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          {mode === "confirm" ? "This morning" : "Tonight"}
        </p>
        <h1
          className="text-[1.375rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          {mode === "confirm" ? "Today's plan" : `Plan ${tomorrowLabel}`}
        </h1>
        <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          {mode === "confirm"
            ? "You set these last night. Confirm them, or start one now."
            : "Two or three blocks is enough. Naming when you'll do something is what makes it happen."}
        </p>
      </header>

      {mode === "confirm" ? (
        <ConfirmList
          blocks={confirmBlocks}
          runningLabel={running?.label ?? null}
        />
      ) : (
        <PlanForm
          target="tomorrow"
          initial={tomorrowBlocks
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

      {mode === "confirm" && tomorrowBlocks.length === 0 ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
          Tomorrow isn&apos;t planned yet — you&apos;ll get a nudge tonight.
        </p>
      ) : null}

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
