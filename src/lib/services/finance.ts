// Service layer for the finance tool.
//
// Server actions, server components, widgets, and (eventually) agent route
// handlers MUST go through this module; they should never touch
// prisma.financeTransaction.* directly. Money values throughout this module
// are integer minor units (cents for USD). Sign convention: negative = debit
// / outflow, positive = credit / inflow.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { parseCurrencyToCents, type FinanceAccountKind } from "@/lib/finance-accounts";
import { inferCategory } from "@/lib/finance-categories";
import { dedupeParsedRows } from "@/lib/finance-import";
import { parseStatementPdf, type StatementImportPreview } from "@/lib/statement-import";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import {
  tellerGetBalances,
  tellerListAccounts,
  tellerListTransactions,
  type TellerAccount,
  type TellerTransaction,
} from "@/lib/teller";
import type { TellerWebhookEvent } from "@/lib/teller-webhooks";
import type {
  FinanceAccount,
  FinanceGoal,
  FinanceTransaction,
} from "@/generated/prisma/client";
import type { FinanceGoalCategory, FinanceGoalOwner, FinanceGoalStatus } from "@/lib/finance-goals";
import type { ParsedRow } from "@/lib/csv";

export type SaveFinanceAccountInput = {
  id?: string;
  name: string;
  kind: FinanceAccountKind;
  currentBalance: string;
  balanceUpdatedAt: string;
  statementBalance?: string;
  dueDate?: string;
  creditLimit?: string;
};

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

export type ImportStatementInput = {
  fileName: string;
  bytes: Uint8Array;
  mimeType?: string;
};

export type LinkedFinanceConnectionSummary = {
  id: string;
  provider: string;
  institutionName: string | null;
  institutionId: string | null;
  enrollmentId: string;
  status: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  disconnectedReason: string | null;
  accountCount: number;
};

export async function listAccounts(userId: string): Promise<FinanceAccount[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeAccount.findMany({
    where: { userId },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
}

export async function listGoals(userId: string): Promise<FinanceGoal[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeGoal.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { targetDate: "asc" }, { name: "asc" }],
  });
}

export async function listTransactions(
  userId: string,
  options: { limit?: number; since?: Date } = {},
): Promise<FinanceTransaction[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeTransaction.findMany({
    where: {
      userId,
      ...(options.since ? { date: { gte: options.since } } : {}),
    },
    orderBy: { date: "desc" },
    take: options.limit ?? 100,
  });
}

export async function countTransactions(userId: string): Promise<number> {
  requireCan(userId, "finance", "read");
  return prisma.financeTransaction.count({ where: { userId } });
}

export async function saveAccount(
  userId: string,
  input: SaveFinanceAccountInput,
): Promise<void> {
  requireCan(userId, "finance", "write");

  const name = input.name.trim();
  if (!name) throw new Error("Account name is required.");
  if (!input.balanceUpdatedAt) throw new Error("Balance date is required.");

  const currentBalanceCents = parseCurrencyToCents(input.currentBalance);
  const statementBalanceCents = input.statementBalance?.trim()
    ? parseCurrencyToCents(input.statementBalance)
    : null;
  const creditLimitCents = input.creditLimit?.trim()
    ? parseCurrencyToCents(input.creditLimit)
    : null;

  const data = {
    name,
    kind: input.kind,
    currentBalanceCents,
    balanceUpdatedAt: new Date(`${input.balanceUpdatedAt}T12:00:00.000Z`),
    statementBalanceCents,
    dueDate: input.dueDate?.trim()
      ? new Date(`${input.dueDate}T12:00:00.000Z`)
      : null,
    creditLimitCents,
  };

  if (input.id) {
    const updated = await prisma.financeAccount.updateMany({
      where: { id: input.id, userId },
      data,
    });
    if (updated.count > 0) {
      await recordEvent({
        userId,
        tool: "finance",
        type: "finance.account_updated",
        refId: input.id,
        meta: { name, kind: input.kind },
      });
    }
    return;
  }

  const created = await prisma.financeAccount.create({
    data: {
      userId,
      ...data,
    },
  });

  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.account_created",
    refId: created.id,
    meta: { name, kind: input.kind },
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

// Sum of debits (amount < 0) since the given instant, as a positive cents
// value. Used by the hub widget for "spent this month".
export async function getSpendCentsSince(
  userId: string,
  since: Date,
): Promise<number> {
  requireCan(userId, "finance", "read");
  const agg = await prisma.financeTransaction.aggregate({
    where: { userId, date: { gte: since }, amount: { lt: 0 } },
    _sum: { amount: true },
  });
  return Math.abs(agg._sum.amount ?? 0);
}

export async function importTransactions(
  userId: string,
  rows: ParsedRow[],
): Promise<{ imported: number; deduped: number }> {
  requireCan(userId, "finance", "write");
  if (rows.length === 0) return { imported: 0, deduped: 0 };

  const sortedDates = rows.map((row) => row.date.getTime()).sort((a, b) => a - b);
  const existing = await prisma.financeTransaction.findMany({
    where: {
      userId,
      date: {
        gte: new Date(sortedDates[0]),
        lte: new Date(sortedDates[sortedDates.length - 1]),
      },
    },
  });

  const { rowsToImport, deduped } = dedupeParsedRows(rows, existing);

  if (rowsToImport.length > 0) {
    await prisma.financeTransaction.createMany({
      data: rowsToImport.map((r) => ({
        userId,
        date: r.date,
        amount: r.amount,
        description: r.description,
        account: r.account,
        category: inferCategory(r.description, r.amount),
        raw: r.raw,
      })),
    });
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.imported",
      meta: { count: rowsToImport.length, deduped },
    });
  }

  return { imported: rowsToImport.length, deduped };
}

export async function importStatement(
  userId: string,
  input: ImportStatementInput,
): Promise<StatementImportPreview & { imported: number; deduped: number }> {
  requireCan(userId, "finance", "write");

  const preview = parseStatementPdf(input);
  if (preview.rows.length === 0) {
    const warning = preview.warnings[0] ?? `No transactions found in ${preview.bankLabel} statement.`;
    throw new Error(warning);
  }

  const { imported, deduped } = await importTransactions(userId, preview.rows);
  return {
    ...preview,
    imported,
    deduped,
  };
}

export async function updateTransactionCategory(
  userId: string,
  id: string,
  category: string,
): Promise<void> {
  requireCan(userId, "finance", "write");
  const updated = await prisma.financeTransaction.updateMany({
    where: { id, userId },
    data: { category },
  });
  if (updated.count > 0) {
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.category_updated",
      refId: id,
      meta: { category },
    });
  }
}

export async function updateMatchingTransactionCategories(
  userId: string,
  input: { description: string; account?: string | null; category: string },
): Promise<number> {
  requireCan(userId, "finance", "write");

  const description = input.description.trim();
  if (!description) return 0;

  const updated = await prisma.financeTransaction.updateMany({
    where: {
      userId,
      description,
      ...(input.account != null ? { account: input.account } : { account: null }),
    },
    data: { category: input.category },
  });

  if (updated.count > 0) {
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.category_bulk_updated",
      meta: {
        category: input.category,
        description,
        account: input.account ?? null,
        count: updated.count,
      },
    });
  }

  return updated.count;
}

export async function deleteAllTransactions(userId: string): Promise<void> {
  requireCan(userId, "finance", "write");
  const { count } = await prisma.financeTransaction.deleteMany({
    where: { userId },
  });
  if (count > 0) {
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.cleared",
      meta: { count },
    });
  }
}

function formatLinkedAccountName(account: TellerAccount): string {
  const suffix = account.last_four ? ` • ${account.last_four}` : "";
  return `${account.name}${suffix}`;
}

function mapTellerAccountKind(account: TellerAccount): FinanceAccountKind {
  const subtype = (account.subtype ?? "").toLowerCase();
  const type = (account.type ?? "").toLowerCase();

  if (subtype.includes("credit") || type === "credit") return "credit_card";
  if (subtype.includes("savings")) return "savings";
  if (subtype.includes("investment") || type === "investment") return "investment";
  if (subtype.includes("retirement")) return "retirement";
  if (subtype.includes("loan") || type === "loan") return "loan";
  return "checking";
}

function tellerMoneyToCents(value: string | null | undefined): number {
  if (!value) return 0;
  return Math.round(Number(value) * 100);
}

function tellerDateToMidday(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function tellerCategoryToFinanceCategory(value: string | null | undefined): string | null {
  if (!value) return null;
  switch (value) {
    case "groceries":
      return "Groceries";
    case "dining":
    case "bar":
      return "Food & Drink";
    case "fuel":
    case "transport":
    case "transportation":
      return "Transport";
    case "utilities":
    case "phone":
    case "service":
      return "Bills & Utilities";
    case "health":
      return "Health";
    case "entertainment":
    case "sport":
      return "Entertainment";
    case "insurance":
      return "Insurance";
    case "income":
      return "Income";
    case "home":
    case "loan":
      return "Housing";
    case "shopping":
    case "clothing":
    case "electronics":
      return "Shopping";
    default:
      return null;
  }
}

async function listAllTellerTransactions(
  accessToken: string,
  accountId: string,
  options: { startDate?: string },
): Promise<TellerTransaction[]> {
  const all: TellerTransaction[] = [];
  let fromId: string | undefined;

  while (true) {
    const batch = await tellerListTransactions(accessToken, accountId, {
      startDate: options.startDate,
      count: 500,
      fromId,
    });

    if (batch.length === 0) break;
    all.push(...batch);

    if (batch.length < 500) break;
    fromId = batch[batch.length - 1]?.id;
    if (!fromId) break;
  }

  return all;
}

async function syncTellerAccountTransactions(
  userId: string,
  account: FinanceAccount,
  accessToken: string,
  lastSyncedAt?: Date | null,
): Promise<number> {
  const startDate = new Date();
  if (lastSyncedAt) {
    startDate.setTime(lastSyncedAt.getTime());
    startDate.setDate(startDate.getDate() - 10);
  } else {
    startDate.setFullYear(startDate.getFullYear() - 1);
  }

  const transactions = await listAllTellerTransactions(accessToken, account.externalId!, {
    startDate: startDate.toISOString().slice(0, 10),
  });

  if (transactions.length === 0) return 0;

  const existing = await prisma.financeTransaction.findMany({
    where: {
      userId,
      externalId: { in: transactions.map((transaction) => transaction.id) },
    },
  });
  const existingByExternalId = new Map(existing.map((transaction) => [transaction.externalId, transaction]));

  let changed = 0;
  for (const transaction of transactions) {
    const existingTransaction = existingByExternalId.get(transaction.id);
    const nextCategory =
      existingTransaction?.category ??
      tellerCategoryToFinanceCategory(transaction.category ?? transaction.details?.category) ??
      inferCategory(transaction.description, tellerMoneyToCents(transaction.amount));

    const data = {
      financeAccountId: account.id,
      syncSource: "teller",
      postedStatus: transaction.status ?? null,
      providerCategory: transaction.category ?? transaction.details?.category ?? null,
      date: tellerDateToMidday(transaction.date),
      amount: tellerMoneyToCents(transaction.amount),
      currency: account.currency,
      description: transaction.description,
      account: account.name,
      category: nextCategory,
      raw: JSON.stringify(transaction),
      updatedAt: new Date(),
    };

    if (existingTransaction) {
      await prisma.financeTransaction.update({
        where: { id: existingTransaction.id },
        data,
      });
    } else {
      await prisma.financeTransaction.create({
        data: {
          userId,
          externalId: transaction.id,
          ...data,
        },
      });
    }
    changed += 1;
  }

  return changed;
}

export async function listLinkedConnections(
  userId: string,
): Promise<LinkedFinanceConnectionSummary[]> {
  requireCan(userId, "finance", "read");
  const connections = await prisma.financeConnection.findMany({
    where: { userId },
    include: { accounts: { select: { id: true } } },
    orderBy: [{ status: "asc" }, { institutionName: "asc" }, { createdAt: "desc" }],
  });

  return connections.map((connection) => ({
    id: connection.id,
    provider: connection.provider,
    institutionName: connection.institutionName,
    institutionId: connection.institutionId,
    enrollmentId: connection.enrollmentId,
    status: connection.status,
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: connection.lastSyncError,
    disconnectedReason: connection.disconnectedReason,
    accountCount: connection.accounts.length,
  }));
}

export async function linkTellerConnection(
  userId: string,
  input: { accessToken: string; enrollmentId?: string | null },
): Promise<LinkedFinanceConnectionSummary> {
  requireCan(userId, "finance", "write");

  const accessToken = input.accessToken.trim();
  if (!accessToken) throw new Error("Missing Teller access token.");

  const tellerAccounts = await tellerListAccounts(accessToken);
  if (tellerAccounts.length === 0) {
    throw new Error("Teller returned no eligible accounts for this connection.");
  }

  const enrollmentId = input.enrollmentId?.trim() || tellerAccounts[0].enrollment_id;
  const institutionName = tellerAccounts[0].institution?.name ?? null;
  const institutionId = tellerAccounts[0].institution?.id ?? null;

  let connection = await prisma.financeConnection.findFirst({
    where: { userId, provider: "teller", enrollmentId },
  });

  if (connection) {
    connection = await prisma.financeConnection.update({
      where: { id: connection.id },
      data: {
        institutionId,
        institutionName,
        accessTokenEnc: encryptSecret(accessToken),
        status: "active",
        disconnectedReason: null,
        lastSyncError: null,
      },
    });
  } else {
    connection = await prisma.financeConnection.create({
      data: {
        userId,
        provider: "teller",
        enrollmentId,
        institutionId,
        institutionName,
        accessTokenEnc: encryptSecret(accessToken),
      },
    });
  }

  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.connection_linked",
    refId: connection.id,
    meta: { provider: "teller", institutionName, enrollmentId },
  });

  await syncFinanceConnection(userId, connection.id);

  const refreshed = await prisma.financeConnection.findUniqueOrThrow({
    where: { id: connection.id },
    include: { accounts: { select: { id: true } } },
  });

  return {
    id: refreshed.id,
    provider: refreshed.provider,
    institutionName: refreshed.institutionName,
    institutionId: refreshed.institutionId,
    enrollmentId: refreshed.enrollmentId,
    status: refreshed.status,
    lastSyncedAt: refreshed.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: refreshed.lastSyncError,
    disconnectedReason: refreshed.disconnectedReason,
    accountCount: refreshed.accounts.length,
  };
}

export async function syncFinanceConnection(
  userId: string,
  connectionId: string,
): Promise<{ accountCount: number; transactionCount: number }> {
  requireCan(userId, "finance", "write");

  const connection = await prisma.financeConnection.findFirst({
    where: { id: connectionId, userId },
  });
  if (!connection) throw new Error("Linked finance connection not found.");

  try {
    const accessToken = decryptSecret(connection.accessTokenEnc);
    const tellerAccounts = await tellerListAccounts(accessToken);

    let transactionCount = 0;
    for (const tellerAccount of tellerAccounts) {
      const balances = await tellerGetBalances(accessToken, tellerAccount.id);
      const accountName = formatLinkedAccountName(tellerAccount);
      const currentBalanceCents = tellerMoneyToCents(balances.available ?? balances.ledger);
      const statementBalanceCents = balances.ledger ? tellerMoneyToCents(balances.ledger) : null;

      const existingAccount = await prisma.financeAccount.findFirst({
        where: { userId, externalId: tellerAccount.id },
      });

      const account = existingAccount
        ? await prisma.financeAccount.update({
            where: { id: existingAccount.id },
            data: {
              connectionId: connection.id,
              syncSource: "teller",
              name: accountName,
              kind: mapTellerAccountKind(tellerAccount),
              currency: tellerAccount.currency ?? "USD",
              currentBalanceCents,
              statementBalanceCents,
              balanceUpdatedAt: new Date(),
            },
          })
        : await prisma.financeAccount.create({
            data: {
              userId,
              connectionId: connection.id,
              externalId: tellerAccount.id,
              syncSource: "teller",
              name: accountName,
              kind: mapTellerAccountKind(tellerAccount),
              currency: tellerAccount.currency ?? "USD",
              currentBalanceCents,
              statementBalanceCents,
              balanceUpdatedAt: new Date(),
            },
          });

      transactionCount += await syncTellerAccountTransactions(
        userId,
        account,
        accessToken,
        connection.lastSyncedAt,
      );
    }

    await prisma.financeConnection.update({
      where: { id: connection.id },
      data: {
        status: "active",
        lastSyncedAt: new Date(),
        lastSyncError: null,
        disconnectedReason: null,
      },
    });

    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.connection_synced",
      refId: connection.id,
      meta: {
        provider: connection.provider,
        institutionName: connection.institutionName,
        accountCount: tellerAccounts.length,
        transactionCount,
      },
    });

    return { accountCount: tellerAccounts.length, transactionCount };
  } catch (error) {
    await prisma.financeConnection.update({
      where: { id: connection.id },
      data: {
        status: "error",
        lastSyncError: error instanceof Error ? error.message : "Unknown sync error.",
      },
    });
    throw error;
  }
}

export async function disconnectFinanceConnection(
  userId: string,
  connectionId: string,
): Promise<void> {
  requireCan(userId, "finance", "write");

  const connection = await prisma.financeConnection.findFirst({
    where: { id: connectionId, userId },
  });
  if (!connection) return;

  await prisma.financeConnection.delete({ where: { id: connection.id } });

  await recordEvent({
    userId,
    tool: "finance",
    type: "finance.connection_disconnected",
    refId: connection.id,
    meta: { provider: connection.provider, institutionName: connection.institutionName },
  });
}

export async function markFinanceConnectionDisconnected(input: {
  provider: string;
  enrollmentId: string;
  reason?: string | null;
}): Promise<void> {
  const connection = await prisma.financeConnection.findFirst({
    where: {
      provider: input.provider,
      enrollmentId: input.enrollmentId,
    },
  });
  if (!connection) return;

  await prisma.financeConnection.update({
    where: { id: connection.id },
    data: {
      status: "disconnected",
      disconnectedReason: input.reason ?? "disconnected",
      lastSyncError: null,
    },
  });

  await recordEvent({
    userId: connection.userId,
    tool: "finance",
    type: "finance.connection_disconnected",
    refId: connection.id,
    meta: {
      provider: connection.provider,
      institutionName: connection.institutionName,
      reason: input.reason ?? null,
    },
  });
}

async function upsertWebhookTransactions(transactions: NonNullable<TellerWebhookEvent["payload"]["transactions"]>): Promise<number> {
  let changed = 0;

  for (const transaction of transactions) {
    const account = await prisma.financeAccount.findFirst({
      where: { externalId: transaction.account_id },
      include: { connection: true },
    });
    if (!account?.connection) continue;

    const nextCategory =
      tellerCategoryToFinanceCategory(transaction.category ?? transaction.details?.category) ??
      inferCategory(transaction.description, tellerMoneyToCents(transaction.amount));

    const existing = await prisma.financeTransaction.findFirst({
      where: {
        userId: account.userId,
        externalId: transaction.id,
      },
    });

    const data = {
      financeAccountId: account.id,
      syncSource: "teller",
      postedStatus: transaction.status ?? null,
      providerCategory: transaction.category ?? transaction.details?.category ?? null,
      date: tellerDateToMidday(transaction.date),
      amount: tellerMoneyToCents(transaction.amount),
      currency: account.currency,
      description: transaction.description,
      account: account.name,
      category: existing?.category ?? nextCategory,
      raw: JSON.stringify(transaction),
      updatedAt: new Date(),
    };

    if (existing) {
      await prisma.financeTransaction.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.financeTransaction.create({
        data: {
          userId: account.userId,
          externalId: transaction.id,
          ...data,
        },
      });
    }

    await prisma.financeConnection.update({
      where: { id: account.connection.id },
      data: {
        status: "active",
        lastSyncedAt: new Date(),
        lastSyncError: null,
        disconnectedReason: null,
      },
    });

    changed += 1;
  }

  return changed;
}

export async function handleTellerWebhookEvent(event: TellerWebhookEvent): Promise<void> {
  switch (event.type) {
    case "webhook.test":
      return;
    case "enrollment.disconnected": {
      if (!event.payload.enrollment_id) return;
      await markFinanceConnectionDisconnected({
        provider: "teller",
        enrollmentId: event.payload.enrollment_id,
        reason: event.payload.reason ?? null,
      });
      return;
    }
    case "transactions.processed": {
      const transactions = event.payload.transactions ?? [];
      const changed = await upsertWebhookTransactions(transactions);

      const userIds = new Set<string>();
      for (const transaction of transactions) {
        const account = await prisma.financeAccount.findFirst({
          where: { externalId: transaction.account_id },
          select: { userId: true },
        });
        if (account) userIds.add(account.userId);
      }

      await Promise.all(
        [...userIds].map((userId) =>
          recordEvent({
            userId,
            tool: "finance",
            type: "finance.webhook_transactions_processed",
            meta: { count: changed },
          }),
        ),
      );
      return;
    }
    default:
      return;
  }
}
