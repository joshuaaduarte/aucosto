// Pure view-model for "living on one paycheck": next month's estimate, the
// budget that fits inside the live-on pay, and the set-aside pots. Inputs are
// already-fetched service rows. Tested in tests/finance-derive-salary.test.ts.

import type { FinanceAccount, FinanceBill, FinanceGoal, FinanceTransaction } from "@/generated/prisma/client";
import { readEntryMeta } from "@/lib/finance-entries";
import { summarizeGoal } from "@/lib/finance-goals";
import { isMoveEntry } from "@/lib/finance-moves";
import { fixedCategorySet } from "@/lib/finance-pacing";
import { detectPaychecks, salaryBudget, type Paycheck } from "@/lib/finance-paychecks";
import { forecastNextMonth } from "@/lib/finance-trends";
import { isTrueExpenseTransaction } from "@/lib/finance-types";

/** Six months of a typical month: the first emergency-fund target. */
export const EMERGENCY_MONTHS = 6;

export type PaycheckFormRow = { name: string; role: "live" | "invest"; perCheck: string };

export function deriveSalary(input: {
  paychecks: Paycheck[];
  history: FinanceTransaction[];
  bills: FinanceBill[];
  goals: FinanceGoal[];
  accounts: Array<Pick<FinanceAccount, "name" | "kind">>;
  /** Category budgets already saved (Flexible and settings excluded). */
  hasLimits: boolean;
  /** Household names to prefill the paycheck form, owner first. */
  people: string[];
  now: Date;
}) {
  const { now } = input;
  const forecast = forecastNextMonth({ history: input.history, bills: input.bills, now });

  const activeGoals = input.goals.filter((g) => g.status !== "done");
  const pots = activeGoals.map((g) => {
    const s = summarizeGoal(g, now);
    return {
      id: g.id,
      name: g.name,
      savedCents: g.currentAmountCents,
      targetCents: g.targetAmountCents,
      monthlyCents: s.monthlyNeededCents,
      targetDateLabel: s.targetDateLabel,
      emergency: g.category === "emergency_fund",
    };
  });
  const potsMonthlyCents = activeGoals
    .filter((g) => g.status === "active")
    .reduce((sum, g) => {
      const s = summarizeGoal(g, now);
      return s.remainingCents > 0 ? sum + s.monthlyNeededCents : sum;
    }, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const spentThisMonthCents = input.history
    .filter(
      (t) => t.date >= monthStart && t.date <= now && !isMoveEntry(t) && !readEntryMeta(t.raw).pot && isTrueExpenseTransaction(t),
    )
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const budget = salaryBudget({
    paychecks: input.paychecks,
    forecast,
    potsMonthlyCents,
    spentThisMonthCents,
    history: input.history,
    now,
  });
  // The everyday (flexible) money is what the suggested limits leave outside
  // fixed bills; it drives the weekly allowance.
  const fixed = fixedCategorySet(input.bills);
  const flexibleCents = budget
    ? budget.suggestedLimits.filter((l) => !fixed.has(l.category)).reduce((sum, l) => sum + l.cents, 0)
    : 0;

  const detected = detectPaychecks(input.history).slice(0, 4);
  const paycheckRows: PaycheckFormRow[] = input.paychecks.length
    ? input.paychecks.map((p) => ({ name: p.name, role: p.role, perCheck: (p.perCheckCents / 100).toFixed(2) }))
    : [0, 1].map((i) => ({
        name: input.people[i] ?? "",
        role: i === 0 ? "live" : "invest",
        perCheck: detected[i] ? (detected[i]!.perCheckCents / 100).toFixed(2) : "",
      }));

  const live = input.paychecks.filter((p) => p.role === "live");
  const invest = input.paychecks.filter((p) => p.role === "invest");
  const heldIn =
    input.accounts.find((a) => a.kind === "savings")?.name ?? input.accounts.find((a) => a.kind === "checking")?.name ?? null;

  return {
    forecast,
    budget,
    liveName: live.map((p) => p.name).join(" & ") || "your",
    investName: invest.length ? invest.map((p) => p.name).join(" & ") : null,
    flexibleCents,
    hasLimits: input.hasLimits,
    pots,
    emergencyTargetCents:
      !pots.some((p) => p.emergency) && forecast.totalCents > 0 ? forecast.totalCents * EMERGENCY_MONTHS : null,
    heldIn,
    detectedCents: detected.map((d) => d.perCheckCents),
    paycheckRows,
  };
}

export type SalaryView = ReturnType<typeof deriveSalary>;
