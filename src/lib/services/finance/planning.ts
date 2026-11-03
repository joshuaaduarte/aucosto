// Budgets and bills/renewals. Scope userId is the finance scope (household
// data user or the person's own id), like every other finance service.
// Reads degrade to empty while the tables don't exist yet
// (scripts/create-household-home.sql).

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { findLatestEvent, recordEvent } from "@/lib/services/events";
import { isMissingHouseholdTable } from "@/lib/household";
import { advanceDueDate, isBillCadence } from "@/lib/finance-planning";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import { FLEXIBLE_BUDGET_KEY } from "@/lib/finance-pacing";
import type { FinanceBill, FinanceBudget } from "@/generated/prisma/client";

function degrade<T>(label: string, fallback: T) {
  return (error: unknown): T => {
    if (!isMissingHouseholdTable(error)) console.error(`[finance] ${label} failed`, error);
    return fallback;
  };
}

export async function listBudgets(userId: string): Promise<FinanceBudget[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeBudget
    .findMany({ where: { userId }, orderBy: { category: "asc" } })
    .catch(degrade("budget list", []));
}

export async function saveBudget(
  userId: string,
  input: { category: string; monthlyLimitCents: number },
): Promise<void> {
  requireCan(userId, "finance", "write");
  if (
    input.category !== FLEXIBLE_BUDGET_KEY &&
    !(FINANCE_CATEGORIES as readonly string[]).includes(input.category)
  ) {
    throw new Error("Pick a category.");
  }
  if (!Number.isFinite(input.monthlyLimitCents) || input.monthlyLimitCents <= 0) {
    throw new Error("Enter a monthly amount above $0.");
  }
  const budget = await prisma.financeBudget.upsert({
    where: { userId_category: { userId, category: input.category } },
    create: { userId, category: input.category, monthlyLimitCents: input.monthlyLimitCents },
    update: { monthlyLimitCents: input.monthlyLimitCents },
  });
  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.budget_saved",
    refId: budget.id,
    meta: { category: input.category, monthlyLimitCents: input.monthlyLimitCents },
  });
}

export async function deleteBudget(userId: string, id: string): Promise<void> {
  requireCan(userId, "finance", "write");
  const { count } = await prisma.financeBudget.deleteMany({ where: { id, userId } });
  if (count > 0) {
    await recordEvent({ userId, tool: "finance", type: "finance.budget_deleted", refId: id });
  }
}

export async function listBills(userId: string): Promise<FinanceBill[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeBill
    .findMany({ where: { userId, archivedAt: null }, orderBy: { nextDueAt: "asc" } })
    .catch(degrade("bill list", []));
}

export type SaveBillInput = {
  id?: string;
  name: string;
  amountCents: number | null;
  cadence: string;
  nextDueAt: Date;
  category?: string | null;
  autopay: boolean;
  notes?: string | null;
};

export async function saveBill(userId: string, input: SaveBillInput): Promise<void> {
  requireCan(userId, "finance", "write");
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Give the bill a name.");
  if (!isBillCadence(input.cadence)) throw new Error("Pick how often it repeats.");
  if (Number.isNaN(input.nextDueAt.getTime())) throw new Error("Pick a due date.");
  const data = {
    name,
    amountCents: input.amountCents,
    cadence: input.cadence,
    nextDueAt: input.nextDueAt,
    category: input.category || null,
    autopay: input.autopay,
    notes: input.notes?.trim() || null,
  };
  if (input.id) {
    const { count } = await prisma.financeBill.updateMany({
      where: { id: input.id, userId },
      data,
    });
    if (count === 0) throw new Error("Bill not found.");
    await recordEvent({ userId, tool: "finance", type: "finance.bill_updated", refId: input.id });
    return;
  }
  const bill = await prisma.financeBill.create({ data: { userId, ...data } });
  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.bill_created",
    refId: bill.id,
    meta: { name },
  });
}

/** Mark paid: advance to the next cycle, or archive a one-time bill. */
export async function markBillPaid(userId: string, id: string, now = new Date()): Promise<void> {
  requireCan(userId, "finance", "write");
  const bill = await prisma.financeBill.findFirst({ where: { id, userId } });
  if (!bill) throw new Error("Bill not found.");
  const next = advanceDueDate(bill.nextDueAt, bill.cadence);
  await prisma.financeBill.update({
    where: { id },
    data: next
      ? { lastPaidAt: now, nextDueAt: next }
      : { lastPaidAt: now, archivedAt: now },
  });
  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.bill_paid",
    refId: id,
    meta: { name: bill.name },
  });
}

export async function archiveBill(userId: string, id: string): Promise<void> {
  requireCan(userId, "finance", "write");
  const { count } = await prisma.financeBill.updateMany({
    where: { id, userId },
    data: { archivedAt: new Date() },
  });
  if (count > 0) {
    await recordEvent({ userId, tool: "finance", type: "finance.bill_archived", refId: id });
  }
}

/** Has anyone in this scope marked this week's money date done? */
export async function getMoneyDateDone(
  userId: string,
  weekKey: string,
): Promise<{ at: Date; actorUserId: string | null } | null> {
  requireCan(userId, "finance", "read");
  const event = await findLatestEvent(userId, "finance.money_date_done", weekKey);
  if (!event) return null;
  const meta = event.meta as { actorUserId?: string } | null;
  return { at: event.at, actorUserId: meta?.actorUserId ?? null };
}

export async function markMoneyDateDone(userId: string, weekKey: string): Promise<void> {
  requireCan(userId, "finance", "write");
  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.money_date_done",
    refId: weekKey,
  });
}
