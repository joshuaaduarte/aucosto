// Move finance data between two scopes: a person's own ("Just me") and the
// household's shared data user. Used when the owner first shares accounts
// with the household, and to take an account back.
//
// A linked (Teller) account always moves together with its whole bank
// connection, because the connection's sync writes to every account under it.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";

export type MoveFinanceInput = {
  accountIds: string[];
  /** Imported transactions that aren't tied to an account (CSV/PDF). */
  includeUnlinkedTransactions?: boolean;
  /** Goals, budgets and bills. */
  includePlanning?: boolean;
};

export type MoveFinanceResult = {
  accounts: number;
  transactions: number;
  duplicatesDropped: number;
  goals: number;
};

export type MovableFinanceSummary = {
  accounts: Array<{
    id: string;
    name: string;
    kind: string;
    connectionId: string | null;
    institutionName: string | null;
    transactionCount: number;
  }>;
  unlinkedTransactionCount: number;
  goalCount: number;
  budgetCount: number;
  billCount: number;
};

export async function summarizeMovableFinance(userId: string): Promise<MovableFinanceSummary> {
  requireCan(userId, "finance", "read");
  const [accounts, unlinkedTransactionCount, goalCount, budgetCount, billCount] =
    await Promise.all([
      prisma.financeAccount.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          kind: true,
          connectionId: true,
          connection: { select: { institutionName: true } },
          _count: { select: { transactions: true } },
        },
      }),
      prisma.financeTransaction.count({ where: { userId, financeAccountId: null } }),
      prisma.financeGoal.count({ where: { userId } }),
      prisma.financeBudget.count({ where: { userId } }).catch(() => 0),
      prisma.financeBill.count({ where: { userId, archivedAt: null } }).catch(() => 0),
    ]);
  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      kind: account.kind,
      connectionId: account.connectionId,
      institutionName: account.connection?.institutionName ?? null,
      transactionCount: account._count.transactions,
    })),
    unlinkedTransactionCount,
    goalCount,
    budgetCount,
    billCount,
  };
}

export async function moveFinanceData(
  fromUserId: string,
  toUserId: string,
  input: MoveFinanceInput,
): Promise<MoveFinanceResult> {
  requireCan(fromUserId, "finance", "write");
  requireCan(toUserId, "finance", "write");
  if (fromUserId === toUserId) throw new Error("Pick a different destination.");

  const result = await prisma.$transaction(async (tx) => {
    const picked = await tx.financeAccount.findMany({
      where: { userId: fromUserId, id: { in: input.accountIds } },
      select: { connectionId: true },
    });
    const connectionIds = [
      ...new Set(picked.map((a) => a.connectionId).filter((id): id is string => Boolean(id))),
    ];
    // Expand to every account under a moving connection.
    const accounts = await tx.financeAccount.findMany({
      where: {
        userId: fromUserId,
        OR: [
          { id: { in: input.accountIds } },
          ...(connectionIds.length ? [{ connectionId: { in: connectionIds } }] : []),
        ],
      },
      select: { id: true, name: true, externalId: true },
    });
    const accountIds = accounts.map((a) => a.id);

    // Unique-constraint conflicts in the destination: stop with a clear error.
    if (accounts.length) {
      const clash = await tx.financeAccount.findFirst({
        where: {
          userId: toUserId,
          OR: [
            { name: { in: accounts.map((a) => a.name) } },
            {
              externalId: {
                in: accounts.map((a) => a.externalId).filter((id): id is string => Boolean(id)),
              },
            },
          ],
        },
        select: { name: true },
      });
      if (clash) {
        throw new Error(`"${clash.name}" already exists there. Rename one of them first.`);
      }
    }
    if (connectionIds.length) {
      const moving = await tx.financeConnection.findMany({
        where: { id: { in: connectionIds } },
        select: { provider: true, enrollmentId: true, institutionName: true },
      });
      const clash = await tx.financeConnection.findFirst({
        where: {
          userId: toUserId,
          OR: moving.map((c) => ({ provider: c.provider, enrollmentId: c.enrollmentId })),
        },
        select: { institutionName: true },
      });
      if (clash) {
        throw new Error(`${clash.institutionName ?? "That bank"} is already linked there.`);
      }
    }

    const txWhere = {
      userId: fromUserId,
      OR: [
        ...(accountIds.length ? [{ financeAccountId: { in: accountIds } }] : []),
        ...(input.includeUnlinkedTransactions ? [{ financeAccountId: null }] : []),
      ],
    };
    let duplicatesDropped = 0;
    let transactions = 0;
    if (txWhere.OR.length) {
      // The same CSV imported on both sides shares externalIds; the copy
      // that's moving is dropped instead of violating @@unique([userId, externalId]).
      const movingExternal = await tx.financeTransaction.findMany({
        where: { ...txWhere, externalId: { not: null } },
        select: { externalId: true },
      });
      const externalIds = movingExternal.map((t) => t.externalId!) ;
      if (externalIds.length) {
        const existing = await tx.financeTransaction.findMany({
          where: { userId: toUserId, externalId: { in: externalIds } },
          select: { externalId: true },
        });
        if (existing.length) {
          const dropped = await tx.financeTransaction.deleteMany({
            where: { ...txWhere, externalId: { in: existing.map((t) => t.externalId!) } },
          });
          duplicatesDropped = dropped.count;
        }
      }
      const moved = await tx.financeTransaction.updateMany({
        where: txWhere,
        data: { userId: toUserId },
      });
      transactions = moved.count;
    }

    if (connectionIds.length) {
      await tx.financeConnection.updateMany({
        where: { id: { in: connectionIds }, userId: fromUserId },
        data: { userId: toUserId },
      });
    }
    if (accountIds.length) {
      await tx.financeAccount.updateMany({
        where: { id: { in: accountIds } },
        data: { userId: toUserId },
      });
    }

    let goals = 0;
    if (input.includePlanning) {
      const [fromGoals, toGoals] = await Promise.all([
        tx.financeGoal.findMany({ where: { userId: fromUserId }, select: { id: true, name: true } }),
        tx.financeGoal.findMany({ where: { userId: toUserId }, select: { name: true } }),
      ]);
      const taken = new Set(toGoals.map((g) => g.name));
      const movable = fromGoals.filter((g) => !taken.has(g.name)).map((g) => g.id);
      if (movable.length) {
        goals = (
          await tx.financeGoal.updateMany({
            where: { id: { in: movable } },
            data: { userId: toUserId },
          })
        ).count;
      }
      const toBudgets = await tx.financeBudget.findMany({
        where: { userId: toUserId },
        select: { category: true },
      });
      await tx.financeBudget.updateMany({
        where: { userId: fromUserId, category: { notIn: toBudgets.map((b) => b.category) } },
        data: { userId: toUserId },
      });
      await tx.financeBill.updateMany({
        where: { userId: fromUserId },
        data: { userId: toUserId },
      });
    }

    return { accounts: accountIds.length, transactions, duplicatesDropped, goals };
  });

  const meta = { ...result, from: fromUserId, to: toUserId };
  await recordEvent({ userId: toUserId, tool: "finance", type: "finance.moved_in", meta });
  await recordEvent({ userId: fromUserId, tool: "finance", type: "finance.moved_out", meta });
  return result;
}
