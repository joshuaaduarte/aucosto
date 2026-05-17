import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { parseCurrencyToCents } from "@/lib/finance-accounts";
import type {
  FinanceGoalCategory,
  FinanceGoalOwner,
  FinanceGoalStatus,
} from "@/lib/finance-goals";
import type { FinanceGoal } from "@/generated/prisma/client";

export type SaveFinanceGoalInput = {
  id?: string;
  name: string;
  owner: FinanceGoalOwner;
  category: FinanceGoalCategory;
  targetAmount: string;
  currentAmount: string;
  targetDate?: string;
  monthlyContribution?: string;
  status: FinanceGoalStatus;
  notes?: string;
};

export async function listGoals(userId: string): Promise<FinanceGoal[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeGoal.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { targetDate: "asc" }, { name: "asc" }],
  });
}

export async function saveGoal(
  userId: string,
  input: SaveFinanceGoalInput,
): Promise<void> {
  requireCan(userId, "finance", "write");

  const name = input.name.trim();
  if (!name) throw new Error("Goal name is required.");

  const targetAmountCents = parseCurrencyToCents(input.targetAmount);
  if (targetAmountCents <= 0) throw new Error("Goal target must be above zero.");

  const currentAmountCents = parseCurrencyToCents(input.currentAmount || "0");
  const monthlyContributionCents = input.monthlyContribution?.trim()
    ? parseCurrencyToCents(input.monthlyContribution)
    : null;

  const data = {
    name,
    owner: input.owner,
    category: input.category,
    targetAmountCents,
    currentAmountCents,
    targetDate: input.targetDate?.trim()
      ? new Date(`${input.targetDate}T12:00:00.000Z`)
      : null,
    monthlyContributionCents,
    status: input.status,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const updated = await prisma.financeGoal.updateMany({
      where: { id: input.id, userId },
      data,
    });
    if (updated.count > 0) {
      await recordEvent({
        userId,
        tool: "finance",
        type: "finance.goal_updated",
        refId: input.id,
        meta: { name, category: input.category, status: input.status },
      });
    }
    return;
  }

  const created = await prisma.financeGoal.create({
    data: {
      userId,
      ...data,
    },
  });

  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.goal_created",
    refId: created.id,
    meta: { name, category: input.category, status: input.status },
  });
}
