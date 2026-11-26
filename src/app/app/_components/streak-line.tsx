"use client";

import Link from "next/link";
import { useState } from "react";
import {
  appStreakLine,
  type AppStreak,
  type StreakDayState,
  type StreakView,
} from "@/lib/app-streak";
import { RestTodayButton } from "./rest-today-button";

// One quiet line for the app-wide weekly streak: seven dots for this week and
// "3 of 5 days this week · 4 weeks running". Deliberately small — it is a
// reason to come back, not a scoreboard — and it never says a streak was lost.
//
// The server sends both versions of the streak (as is, and with today's rest
// day flipped), so "Taking today off" updates the line the moment it saves.

const WEEKDAY = ["M", "T", "W", "T", "F", "S", "S"];

const STATE_LABEL: Record<StreakDayState, string> = {
  done: "showed up",
  rest: "rest day",
  missed: "no entries",
  today: "today, nothing yet",
  future: "still to come",
};

function Dot({ state }: { state: StreakDayState }) {
  const base = "inline-block h-2.5 w-2.5 rounded-full";
  if (state === "done") {
    return <span className={base} style={{ background: "var(--accent)" }} />;
  }
  if (state === "rest") {
    return (
      <span
        className={base}
        style={{ background: "color-mix(in srgb, var(--text-faint) 35%, transparent)" }}
      />
    );
  }
  if (state === "today") {
    return <span className={base} style={{ boxShadow: "inset 0 0 0 1.5px var(--accent)" }} />;
  }
  // Missed and future look the same on purpose: a past gap is not marked.
  return (
    <span
      className={base}
      style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--text-faint) 55%, transparent)" }}
    />
  );
}

export function StreakLine({ view, href }: { view: StreakView; href?: string }) {
  // What the person last asked for (rest today or not), if anything. Server
  // refreshes can land late or out of order, so the line follows the latest
  // tap rather than whichever payload arrived last.
  const [wantRest, setWantRest] = useState<boolean | null>(null);
  const restingNow = (s: AppStreak) =>
    s.thisWeek.days.some((day) => day.key === s.todayKey && day.state === "rest");
  const streak =
    wantRest === null || restingNow(view.current) === wantRest ? view.current : view.ifTodayToggled;
  const days = streak.thisWeek.days;
  const summary = appStreakLine(streak);
  const label = `This week: ${days
    .map((day, i) => `${WEEKDAY[i]} ${STATE_LABEL[day.state]}`)
    .join(", ")}. ${summary}`;

  const body = (
    <>
      <span className="flex items-center gap-1" aria-hidden="true">
        {days.map((day) => (
          <Dot key={day.key} state={day.state} />
        ))}
      </span>
      <span className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        {summary}
      </span>
    </>
  );

  const className = "inline-flex items-center gap-2.5 rounded-full py-1";
  const line = href ? (
    <Link href={href} className={`${className} hover:opacity-80`} aria-label={label} data-testid="app-streak">
      {body}
    </Link>
  ) : (
    <p className={className} aria-label={label} data-testid="app-streak">
      {body}
    </p>
  );

  // Offer a rest day only while today is still open (or already resting).
  const today = days.find((day) => day.key === streak.todayKey);
  const canRest = today?.state === "today" || today?.state === "rest";
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {line}
      {canRest ? (
        <RestTodayButton
          resting={today?.state === "rest"}
          onSaved={(rest) => setWantRest(rest)}
        />
      ) : null}
    </div>
  );
}
