// Day-to-day tracking: hand-logged entries, balance history, statement
// checks, and projection settings. Scope userId is the finance scope
// (household data user or the person's own id), like every finance service.
//
// Entries use existing FinanceTransaction columns (status in postedStatus,
// who-logged-it in raw; see src/lib/finance-entries.ts). Balance snapshots,
// statement checks and account plans live in new tables
// (scripts/create-finance-tracking.sql); reads degrade to empty until it runs.

import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { currentActorUserId } from "@/lib/actor";
import { recordEvent } from "@/lib/services/events";
import { isMissingHouseholdTable } from "@/lib/household";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import {
  ENTRY_PENDING,
  ENTRY_RECONCILED,
  encodeEntryMeta,
  type EntryVia,
} from "@/lib/finance-entries";
import {
  checkStatementBalance,
  matchStatement,
  type StatementMatch,
} from "@/lib/finance-statement-match";
import type {
  FinanceAccountPlan,
  FinanceBalanceSnapshot,
  FinanceStatementCheck,
  FinanceTransaction,
} from "@/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the tracking tables haven't been created yet. */
export function isTrackingSetupError(error: unknown): boolean {
  return isMissingHouseholdTable(error);
}

function degrade<T>(label: string, fallback: T) {
  return (error: unknown): T => {
    if (!isTrackingSetupError(error)) console.error(`[finance] ${label} failed`, error);
    return fallback;
  };
}

function cleanCategory(value: string | null | undefined): string | null {
  if (!value) return null;
  return (FINANCE_CATEGORIES as readonly string[]).includes(value) ? value : null;
}

async function requireAccount(userId: string, accountId: string) {
  const account = await prisma.financeAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new Error("That account isn't in this space.");
  return account;
}

// ── Entries ──────────────────────────────────────────────────────────────

export type AddEntryInput = {
  /** Positive cents. */
  amountCents: number;
  direction: "out" | "in";
  description: string;
  category?: string | null;
  financeAccountId?: string | null;
  date: Date;
  via?: EntryVia;
  /** Who logged it; defaults to the acting viewer. */
  byUserId?: string | null;
};

export async function addEntry(userId: string, input: AddEntryInput): Promise<FinanceTransaction> {
  requireCan(userId, "finance", "write");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Enter an amount above $0.");
  }
  if (input.amountCents > 100_000_000) throw new Error("That amount looks too large.");
  if (Number.isNaN(input.date.getTime())) throw new Error("Pick a date.");
  const description = input.description.trim().replace(/\s+/g, " ").slice(0, 120) || "Spending";
  const account = input.financeAccountId ? await requireAccount(userId, input.financeAccountId) : null;
  const by = input.byUserId ?? currentActorUserId() ?? undefined;

  const entry = await prisma.financeTransaction.create({
    data: {
      userId,
      financeAccountId: account?.id ?? null,
      account: account?.name ?? null,
      externalId: `manual:${randomUUID()}`,
      syncSource: "manual",
      postedStatus: ENTRY_PENDING,
      date: input.date,
      amount: input.direction === "out" ? -input.amountCents : input.amountCents,
      description,
      category: input.direction === "in" ? "Income" : cleanCategory(input.category),
      raw: encodeEntryMeta({ by, via: input.via ?? "quick_add" }),
    },
  });
  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.entry_added",
    refId: entry.id,
    meta: { amount: entry.amount, via: input.via ?? "quick_add" },
  });
  return entry;
}

export type UpdateEntryInput = {
  amountCents?: number;
  direction?: "out" | "in";
  description?: string;
  category?: string | null;
  financeAccountId?: string | null;
  date?: Date;
};

export async function updateEntry(userId: string, id: string, patch: UpdateEntryInput): Promise<void> {
  requireCan(userId, "finance", "write");
  const existing = await prisma.financeTransaction.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Entry not found.");
  if (existing.postedStatus === ENTRY_RECONCILED) {
    throw new Error("This one matches a checked statement, so it's locked.");
  }
  const data: Partial<FinanceTransaction> = {};
  if (patch.amountCents !== undefined || patch.direction !== undefined) {
    const cents = patch.amountCents ?? Math.abs(existing.amount);
    if (!Number.isInteger(cents) || cents <= 0) throw new Error("Enter an amount above $0.");
    const out = (patch.direction ?? (existing.amount < 0 ? "out" : "in")) === "out";
    data.amount = out ? -cents : cents;
  }
  if (patch.description !== undefined) {
    const description = patch.description.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!description) throw new Error("Give it a name.");
    data.description = description;
  }
  if (patch.category !== undefined) data.category = cleanCategory(patch.category);
  if (patch.date !== undefined) {
    if (Number.isNaN(patch.date.getTime())) throw new Error("Pick a date.");
    data.date = patch.date;
  }
  if (patch.financeAccountId !== undefined) {
    const account = patch.financeAccountId ? await requireAccount(userId, patch.financeAccountId) : null;
    data.financeAccountId = account?.id ?? null;
    data.account = account?.name ?? null;
  }
  await prisma.financeTransaction.update({ where: { id }, data });
  await recordEvent({ userId, tool: "finance", type: "finance.entry_updated", refId: id });
}

export async function deleteEntry(userId: string, id: string): Promise<void> {
  requireCan(userId, "finance", "write");
  const existing = await prisma.financeTransaction.findFirst({ where: { id, userId } });
  if (!existing) return;
  if (existing.postedStatus === ENTRY_RECONCILED) {
    throw new Error("This one matches a checked statement, so it's locked.");
  }
  await prisma.financeTransaction.delete({ where: { id } });
  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.entry_deleted",
    refId: id,
    meta: { amount: existing.amount, description: existing.description },
  });
}

/** Entries logged today (local server day), for the evening nudge. */
export async function countEntriesSince(userId: string, since: Date): Promise<number> {
  requireCan(userId, "finance", "read");
  return prisma.financeTransaction.count({
    where: { userId, syncSource: "manual", createdAt: { gte: since } },
  });
}

// ── Balance history ──────────────────────────────────────────────────────

export async function listBalanceSnapshots(
  userId: string,
): Promise<{ ready: boolean; snapshots: FinanceBalanceSnapshot[] }> {
  requireCan(userId, "finance", "read");
  try {
    const snapshots = await prisma.financeBalanceSnapshot.findMany({
      where: { userId },
      orderBy: { asOf: "asc" },
      take: 5000,
    });
    return { ready: true, snapshots };
  } catch (error) {
    degrade("balance history", null)(error);
    return { ready: false, snapshots: [] };
  }
}

async function recordSnapshot(
  userId: string,
  accountId: string,
  balanceCents: number,
  asOf: Date,
  source: "manual" | "statement",
): Promise<void> {
  await prisma.financeBalanceSnapshot
    .create({ data: { userId, financeAccountId: accountId, balanceCents, asOf, source } })
    .catch(degrade("balance snapshot", null));
}

/** Called by saveAccount whenever a balance changes. Never throws. */
export async function recordBalanceSnapshot(
  userId: string,
  accountId: string,
  balanceCents: number,
  asOf: Date,
): Promise<void> {
  await recordSnapshot(userId, accountId, balanceCents, asOf, "manual");
}

/** "Update balance": new balance as of a day, with a history point. */
export async function updateAccountBalance(
  userId: string,
  accountId: string,
  balanceCents: number,
  asOf: Date,
): Promise<void> {
  requireCan(userId, "finance", "write");
  if (!Number.isInteger(balanceCents)) throw new Error("Enter a balance.");
  if (Number.isNaN(asOf.getTime())) throw new Error("Pick a date.");
  const account = await requireAccount(userId, accountId);
  if (asOf >= account.balanceUpdatedAt) {
    await prisma.financeAccount.update({
      where: { id: accountId },
      data: { currentBalanceCents: balanceCents, balanceUpdatedAt: asOf },
    });
  }
  await recordSnapshot(userId, accountId, balanceCents, asOf, "manual");
  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.balance_updated",
    refId: accountId,
    meta: { name: account.name },
  });
}

// ── Projection settings ──────────────────────────────────────────────────

export async function listAccountPlans(
  userId: string,
): Promise<{ ready: boolean; plans: FinanceAccountPlan[] }> {
  requireCan(userId, "finance", "read");
  try {
    return { ready: true, plans: await prisma.financeAccountPlan.findMany({ where: { userId } }) };
  } catch (error) {
    degrade("account plans", null)(error);
    return { ready: false, plans: [] };
  }
}

export async function saveAccountPlan(
  userId: string,
  accountId: string,
  input: { monthlyContributionCents: number; annualGrowthBps: number },
): Promise<void> {
  requireCan(userId, "finance", "write");
  await requireAccount(userId, accountId);
  const monthlyContributionCents = Math.max(0, Math.round(input.monthlyContributionCents));
  const annualGrowthBps = Math.round(input.annualGrowthBps);
  if (annualGrowthBps < -5000 || annualGrowthBps > 5000) {
    throw new Error("Use a yearly rate between -50% and 50%.");
  }
  try {
    await prisma.financeAccountPlan.upsert({
      where: { financeAccountId: accountId },
      create: { financeAccountId: accountId, userId, monthlyContributionCents, annualGrowthBps },
      update: { monthlyContributionCents, annualGrowthBps },
    });
  } catch (error) {
    if (isTrackingSetupError(error)) {
      throw new Error("Projection settings need a one-time database update first.");
    }
    throw error;
  }
  await recordEvent({ userId, tool: "finance", type: "finance.plan_saved", refId: accountId });
}

// ── Statement checks ─────────────────────────────────────────────────────

export async function listStatementChecks(
  userId: string,
): Promise<{ ready: boolean; checks: FinanceStatementCheck[] }> {
  requireCan(userId, "finance", "read");
  try {
    const checks = await prisma.financeStatementCheck.findMany({
      where: { userId },
      orderBy: { periodEnd: "desc" },
      take: 200,
    });
    return { ready: true, checks };
  } catch (error) {
    degrade("statement checks", null)(error);
    return { ready: false, checks: [] };
  }
}

export type StatementLineInput = {
  key: string;
  date: Date;
  amount: number;
  description: string;
};

export type StatementPreview = {
  account: { id: string; name: string; kind: string };
  lines: StatementLineInput[];
  entries: Array<Pick<FinanceTransaction, "id" | "date" | "amount" | "description" | "category" | "postedStatus">>;
  match: StatementMatch;
  periodStart: Date;
  periodEnd: Date;
  /** Closing balance of the last finished check, as this one's opening. */
  suggestedOpeningCents: number | null;
};

export function statementLineKey(accountId: string, line: { date: Date; amount: number; description: string }, index: number): string {
  return createHash("sha1")
    .update([accountId, line.date.toISOString().slice(0, 10), line.amount, line.description.trim().toLowerCase(), index].join("|"))
    .digest("hex")
    .slice(0, 20);
}

export async function previewStatementCheck(
  userId: string,
  accountId: string,
  rawLines: Array<{ date: Date; amount: number; description: string }>,
): Promise<StatementPreview> {
  requireCan(userId, "finance", "read");
  const account = await requireAccount(userId, accountId);
  if (rawLines.length === 0) throw new Error("No transactions found in that file.");
  const lines = rawLines.map((line, index) => ({
    ...line,
    description: line.description.trim().slice(0, 200),
    key: statementLineKey(accountId, line, index),
  }));
  const times = lines.map((l) => l.date.getTime());
  const periodStart = new Date(Math.min(...times));
  const periodEnd = new Date(Math.max(...times));

  const entries = await prisma.financeTransaction.findMany({
    where: {
      userId,
      financeAccountId: accountId,
      OR: [{ postedStatus: null }, { postedStatus: { not: ENTRY_RECONCILED } }],
      date: {
        gte: new Date(periodStart.getTime() - 7 * DAY_MS),
        lte: new Date(periodEnd.getTime() + 7 * DAY_MS),
      },
    },
    orderBy: { date: "asc" },
    select: { id: true, date: true, amount: true, description: true, category: true, postedStatus: true },
  });

  const last = await prisma.financeStatementCheck
    .findFirst({ where: { userId, financeAccountId: accountId }, orderBy: { periodEnd: "desc" } })
    .catch(degrade("last statement check", null));

  return {
    account: { id: account.id, name: account.name, kind: account.kind },
    lines,
    entries,
    match: matchStatement(lines, entries),
    periodStart,
    periodEnd,
    suggestedOpeningCents: last?.closingBalanceCents ?? null,
  };
}

export type CommitStatementInput = {
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  openingCents: number;
  closingCents: number;
  /** Logged entries confirmed by a statement line; the line's values win. */
  matches: Array<{ entryId: string; line: StatementLineInput }>;
  /** Statement lines to add as new entries. */
  additions: StatementLineInput[];
  /** Logged entries in the period that aren't on the statement. */
  notOnStatement: string[];
  /** Add a labelled adjustment if the balances don't add up. */
  allowAdjustment: boolean;
};

export async function commitStatementCheck(
  userId: string,
  input: CommitStatementInput,
): Promise<{ differenceCents: number; adjusted: boolean; checkId: string }> {
  requireCan(userId, "finance", "write");
  const account = await requireAccount(userId, input.accountId);
  const actor = currentActorUserId() ?? undefined;
  const statementAmounts = [
    ...input.matches.map((m) => m.line.amount),
    ...input.additions.map((l) => l.amount),
  ];
  const balance = checkStatementBalance({
    kind: account.kind,
    openingCents: input.openingCents,
    closingCents: input.closingCents,
    entryAmounts: statementAmounts,
  });
  if (balance.differenceCents !== 0 && !input.allowAdjustment) {
    throw new Error("The statement doesn't add up yet. Check the balances or add an adjustment.");
  }

  const entryIds = [...input.matches.map((m) => m.entryId), ...input.notOnStatement];
  const owned = await prisma.financeTransaction.findMany({
    where: { id: { in: entryIds }, userId, financeAccountId: input.accountId },
    select: { id: true, postedStatus: true },
  });
  const ownedIds = new Set(owned.filter((e) => e.postedStatus !== ENTRY_RECONCILED).map((e) => e.id));
  for (const id of entryIds) {
    if (!ownedIds.has(id)) throw new Error("Some entries changed while you were checking. Start the check again.");
  }

  const check = await prisma.$transaction(async (tx) => {
    for (const m of input.matches) {
      await tx.financeTransaction.update({
        where: { id: m.entryId },
        data: {
          amount: m.line.amount,
          date: m.line.date,
          postedStatus: ENTRY_RECONCILED,
        },
      });
    }
    if (input.notOnStatement.length) {
      await tx.financeTransaction.updateMany({
        where: { id: { in: input.notOnStatement }, userId },
        data: { postedStatus: ENTRY_PENDING },
      });
    }
    if (input.additions.length) {
      await tx.financeTransaction.createMany({
        data: input.additions.map((line) => ({
          userId,
          financeAccountId: account.id,
          account: account.name,
          externalId: `stmt:${account.id}:${line.key}`,
          syncSource: "statement",
          postedStatus: ENTRY_RECONCILED,
          date: line.date,
          amount: line.amount,
          description: line.description,
          category: null,
          raw: encodeEntryMeta({ by: actor, via: "statement" }),
        })),
        skipDuplicates: true,
      });
    }
    if (balance.differenceCents !== 0) {
      await tx.financeTransaction.create({
        data: {
          userId,
          financeAccountId: account.id,
          account: account.name,
          externalId: `adjust:${randomUUID()}`,
          syncSource: "manual",
          postedStatus: ENTRY_RECONCILED,
          date: input.periodEnd,
          amount: balance.adjustmentAmountCents,
          description: "Balance adjustment (statement check)",
          category: "Other",
          raw: encodeEntryMeta({ by: actor, via: "adjustment" }),
        },
      });
    }
    const created = await tx.financeStatementCheck.create({
      data: {
        userId,
        financeAccountId: account.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        openingBalanceCents: input.openingCents,
        closingBalanceCents: input.closingCents,
        adjustmentCents: balance.differenceCents,
        matchedCount: input.matches.length,
        addedCount: input.additions.length,
        checkedByUserId: actor ?? null,
      },
    });
    await tx.financeBalanceSnapshot.create({
      data: {
        userId,
        financeAccountId: account.id,
        balanceCents: input.closingCents,
        asOf: input.periodEnd,
        source: "statement",
      },
    });
    if (input.periodEnd >= account.balanceUpdatedAt) {
      await tx.financeAccount.update({
        where: { id: account.id },
        data: { currentBalanceCents: input.closingCents, balanceUpdatedAt: input.periodEnd },
      });
    }
    return created;
  });

  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.statement_checked",
    refId: check.id,
    meta: {
      account: account.name,
      matched: input.matches.length,
      added: input.additions.length,
      adjustmentCents: balance.differenceCents,
    },
  });
  return { differenceCents: balance.differenceCents, adjusted: balance.differenceCents !== 0, checkId: check.id };
}

