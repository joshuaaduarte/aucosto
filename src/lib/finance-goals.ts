import type { FinanceGoal } from "@/generated/prisma/client";

export const FINANCE_GOAL_OWNERS = ["shared", "joshua", "ana"] as const;
export const FINANCE_GOAL_CATEGORIES = [
  "general",
  "wedding",
  "emergency_fund",
  "vacation",
  "project",
  "home",
  "education",
] as const;
export const FINANCE_GOAL_STATUSES = ["active", "paused", "done"] as const;

export type FinanceGoalOwner = (typeof FINANCE_GOAL_OWNERS)[number];
export type FinanceGoalCategory = (typeof FINANCE_GOAL_CATEGORIES)[number];
export type FinanceGoalStatus = (typeof FINANCE_GOAL_STATUSES)[number];

export type GoalProgress = {
  fundedCents: number;
  remainingCents: number;
  fundedPercent: number;
  monthlyNeededCents: number;
  targetDateLabel: string | null;
};

export function formatGoalOwner(owner: string): string {
  switch (owner) {
    case "joshua":
      return "Joshua";
    case "ana":
      return "Ana";
    default:
      return "Shared";
  }
}

export function formatGoalCategory(category: string): string {
  switch (category) {
    case "emergency_fund":
      return "Emergency fund";
    case "wedding":
      return "Wedding";
    case "vacation":
      return "Vacation";
    case "project":
      return "Project";
    case "home":
      return "Home";
    case "education":
      return "Education";
    default:
      return "General";
  }
}

export function summarizeGoal(goal: Pick<FinanceGoal, "targetAmountCents" | "currentAmountCents" | "targetDate" | "monthlyContributionCents">, now = new Date()): GoalProgress {
  const fundedCents = goal.currentAmountCents;
  const remainingCents = Math.max(0, goal.targetAmountCents - goal.currentAmountCents);
  const fundedPercent = goal.targetAmountCents <= 0 ? 0 : Math.min(100, Math.round((fundedCents / goal.targetAmountCents) * 100));

  let monthlyNeededCents = goal.monthlyContributionCents ?? 0;
  let targetDateLabel: string | null = null;

  if (goal.targetDate) {
    targetDateLabel = goal.targetDate.toLocaleDateString([], { month: "short", year: "numeric" });
    const monthsRemaining = Math.max(
      1,
      (goal.targetDate.getFullYear() - now.getFullYear()) * 12 +
        (goal.targetDate.getMonth() - now.getMonth()) +
        (goal.targetDate.getDate() >= now.getDate() ? 0 : -1) +
        1,
    );
    monthlyNeededCents = Math.max(monthlyNeededCents, Math.ceil(remainingCents / monthsRemaining));
  }

  return {
    fundedCents,
    remainingCents,
    fundedPercent,
    monthlyNeededCents,
    targetDateLabel,
  };
}

export function summarizeGoals(goals: Pick<FinanceGoal, "targetAmountCents" | "currentAmountCents" | "targetDate" | "monthlyContributionCents" | "status">[], now = new Date()) {
  const activeGoals = goals.filter((goal) => goal.status !== "done");

  const totals = activeGoals.reduce(
    (acc, goal) => {
      const summary = summarizeGoal(goal, now);
      acc.targetCents += goal.targetAmountCents;
      acc.fundedCents += goal.currentAmountCents;
      acc.remainingCents += summary.remainingCents;
      acc.monthlyNeededCents += summary.monthlyNeededCents;
      return acc;
    },
    { targetCents: 0, fundedCents: 0, remainingCents: 0, monthlyNeededCents: 0 },
  );

  return {
    ...totals,
    fundedPercent: totals.targetCents <= 0 ? 0 : Math.min(100, Math.round((totals.fundedCents / totals.targetCents) * 100)),
    activeCount: activeGoals.length,
  };
}
