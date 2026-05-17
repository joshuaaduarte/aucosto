// Pull-based Teller sync (account upserts + transaction backfill). Webhook
// upserts live in webhooks.ts.

import "server-only";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/services/events";
import { requireCan } from "@/lib/auth/can";
import { defaultAccountInclusion } from "@/lib/finance-accounts";
import { decryptSecret } from "@/lib/secrets";
import {
  tellerGetBalances,
  tellerListAccounts,
  tellerListTransactions,
  type TellerTransaction,
} from "@/lib/teller";
import type { FinanceAccount } from "@/generated/prisma/client";
import {
  formatLinkedAccountName,
  inferSyncedCategory,
  mapTellerAccountKind,
  normalizeSyncedAmountCents,
  tellerDateToMidday,
  tellerMoneyToCents,
} from "./shared";

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
  const existingByExternalId = new Map(
    existing.map((transaction) => [transaction.externalId, transaction]),
  );

  let changed = 0;
  for (const transaction of transactions) {
    const existingTransaction = existingByExternalId.get(transaction.id);
    const normalizedAmount = normalizeSyncedAmountCents(
      account.kind,
      tellerMoneyToCents(transaction.amount),
    );
    const nextCategory =
      existingTransaction?.category ??
      inferSyncedCategory({
        providerCategory: transaction.category ?? transaction.details?.category,
        description: transaction.description,
        amount: normalizedAmount,
      });

    const data = {
      financeAccountId: account.id,
      syncSource: "teller",
      postedStatus: transaction.status ?? null,
      providerCategory: transaction.category ?? transaction.details?.category ?? null,
      date: tellerDateToMidday(transaction.date),
      amount: normalizedAmount,
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
              includeInNetWorth: existingAccount.includeInNetWorth,
              includeInCashPosition: existingAccount.includeInCashPosition,
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
              ...defaultAccountInclusion(mapTellerAccountKind(tellerAccount)),
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
