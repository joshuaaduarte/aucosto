import "server-only";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/services/events";
import type { TellerWebhookEvent } from "@/lib/teller-webhooks";
import { markFinanceConnectionDisconnected } from "./connections";
import {
  inferSyncedCategory,
  normalizeSyncedAmountCents,
  tellerDateToMidday,
  tellerMoneyToCents,
} from "./shared";

type WebhookTransaction = NonNullable<TellerWebhookEvent["payload"]["transactions"]>[number];

type UpsertResult = {
  changed: number;
  changedConnectionIds: Set<string>;
  changedUserIds: Set<string>;
};

async function upsertWebhookTransactions(
  transactions: WebhookTransaction[],
): Promise<UpsertResult> {
  const result: UpsertResult = {
    changed: 0,
    changedConnectionIds: new Set(),
    changedUserIds: new Set(),
  };
  if (transactions.length === 0) return result;

  // Batch-resolve the account + connection metadata once instead of per-tx.
  // A burst webhook can include dozens of transactions across a few accounts,
  // so one IN query saves N round-trips.
  const accountExternalIds = Array.from(
    new Set(transactions.map((t) => t.account_id)),
  );
  const accounts = await prisma.financeAccount.findMany({
    where: { externalId: { in: accountExternalIds } },
    include: { connection: true },
  });
  const accountByExternalId = new Map(accounts.map((a) => [a.externalId!, a]));

  const txExternalIds = transactions.map((t) => t.id);
  const existingTxs = await prisma.financeTransaction.findMany({
    where: { externalId: { in: txExternalIds } },
  });
  const existingTxByExternalId = new Map(
    existingTxs.map((tx) => [tx.externalId!, tx]),
  );

  for (const transaction of transactions) {
    const account = accountByExternalId.get(transaction.account_id);
    if (!account?.connection) continue;

    const normalizedAmount = normalizeSyncedAmountCents(
      account.kind,
      tellerMoneyToCents(transaction.amount),
    );
    const existing = existingTxByExternalId.get(transaction.id);
    const nextCategory =
      existing?.category ??
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

    result.changed += 1;
    result.changedConnectionIds.add(account.connection.id);
    result.changedUserIds.add(account.userId);
  }

  if (result.changedConnectionIds.size > 0) {
    await prisma.financeConnection.updateMany({
      where: { id: { in: [...result.changedConnectionIds] } },
      data: {
        status: "active",
        lastSyncedAt: new Date(),
        lastSyncError: null,
        disconnectedReason: null,
      },
    });
  }

  return result;
}

export async function handleTellerWebhookEvent(
  event: TellerWebhookEvent,
): Promise<void> {
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
      const { changed, changedUserIds } = await upsertWebhookTransactions(transactions);

      await Promise.all(
        [...changedUserIds].map((userId) =>
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
