// "Right now" prompts on the hub. Derived from real data so the dashboard
// has a chance of feeling alive: if a timer is running, it leads; if a card
// is due soon, it nudges; otherwise it surfaces a weekly tracking total or
// onboarding hint. All inputs are optional - the page passes whatever it has
// and we degrade gracefully.

import { summarizeBalances } from "@/lib/finance-accounts";
import {
  daysUntil,
  formatUSDFromCents,
  formatSignedUSDFromCents,
} from "@/lib/money";
import type { FinanceAccount, TimeEntry } from "@/generated/prisma/client";

export type HubPrompt = {
  text: string;
  tone: "sky" | "amber" | "emerald" | "zinc";
  ctaLabel: string;
  href: string;
};

export type HubPromptInput = {
  runningEntry: Pick<TimeEntry, "label" | "category" | "startedAt"> | null;
  weekTotalMs: number;
  accounts?: FinanceAccount[];
  thisMonthSpentCents?: number;
  lastMonthSpentCents?: number;
};

const FALLBACK_PROMPTS: HubPrompt[] = [
  {
    text: "No plan is protected yet. Add one real block before the day gets noisy.",
    tone: "sky",
    ctaLabel: "Plan today",
    href: "/app/calendar",
  },
  {
    text: "Nothing is asking for attention yet. Use that quiet moment to line up the next move.",
    tone: "zinc",
    ctaLabel: "Open workspace",
    href: "/app/do",
  },
];

export function deriveHubPrompts(input: HubPromptInput): HubPrompt[] {
  const prompts: HubPrompt[] = [];

  if (input.runningEntry) {
    const startedAt = input.runningEntry.startedAt;
    const ranMinutes = Math.max(
      0,
      Math.round((Date.now() - startedAt.getTime()) / 60000),
    );
    const suffix = ranMinutes > 0 ? `, running ${ranMinutes}m` : "";
    prompts.push({
      text: `Timer has been running on ${input.runningEntry.label}${suffix}. Stop and reflect while it is still fresh.`,
      tone: "sky",
      ctaLabel: "Review session",
      href: "/app/time",
    });
  } else if (input.weekTotalMs > 0) {
    const hours = input.weekTotalMs / (1000 * 60 * 60);
    prompts.push({
      text: `${hours.toFixed(1)}h is already logged this week. Protect the next block before the day drifts.`,
      tone: "sky",
      ctaLabel: "Plan next block",
      href: "/app/calendar",
    });
  }

  if (input.accounts && input.accounts.length > 0) {
    const dueSoon = pickNextDueCard(input.accounts);
    if (dueSoon) {
      const days = daysUntil(dueSoon.dueDate);
      if (days <= 7) {
        // A due date with a time component can slip just past midnight and
        // still pass the 24h grace filter — never render "in -1 days".
        const whenLabel =
          days < 0
            ? "yesterday"
            : days === 0
              ? "today"
              : days === 1
                ? "tomorrow"
                : `in ${days} days`;
        prompts.push({
          text: `Card due ${whenLabel}: ${formatUSDFromCents(dueSoon.balanceCents)} on ${dueSoon.name}.`,
          tone: days <= 3 ? "amber" : "zinc",
          ctaLabel: "Review finance",
          href: "/app/finance",
        });
      }
    }
  }

  if (
    input.thisMonthSpentCents !== undefined &&
    input.lastMonthSpentCents !== undefined &&
    input.lastMonthSpentCents > 0
  ) {
    const delta = input.thisMonthSpentCents - input.lastMonthSpentCents;
    const pct = Math.round((delta / input.lastMonthSpentCents) * 100);
    if (Math.abs(pct) >= 10) {
      prompts.push({
        text:
          delta > 0
            ? `Spend pace is ${formatSignedUSDFromCents(delta)} vs last month (+${pct}%). Worth reviewing before it spreads.`
            : `Spend pace is ${formatUSDFromCents(Math.abs(delta))} lower than last month (${pct}%). Check whether that calm is real or just timing.`,
        tone: delta > 0 ? "amber" : "emerald",
        ctaLabel: "Open finance",
        href: "/app/finance",
      });
    }
  }

  if (prompts.length === 0) {
    return FALLBACK_PROMPTS;
  }

  if (prompts.length < 3) {
    prompts.push(FALLBACK_PROMPTS[0]!);
  }

  return prompts.slice(0, 3);
}

function pickNextDueCard(accounts: FinanceAccount[]) {
  const cards = accounts
    .filter((a) => a.kind === "credit_card" && a.dueDate)
    .map((a) => ({
      name: a.name,
      dueDate: a.dueDate!,
      balanceCents: a.statementBalanceCents ?? a.currentBalanceCents,
    }))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  // skip past dues - they need a different surface than "right now"
  const upcoming = cards.find((c) => c.dueDate.getTime() >= Date.now() - 24 * 60 * 60 * 1000);

  // Summarize to avoid "0 days left" weirdness once the day rolls past.
  return upcoming ?? null;
}

// Keep the summary helper exported for tests / future widgets that want a
// "snapshot" reading without re-doing the math.
export function summarizeForPrompts(accounts: FinanceAccount[]) {
  return summarizeBalances(accounts);
}
