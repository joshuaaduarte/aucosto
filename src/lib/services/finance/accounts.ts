// Manual account CRUD. Linked-account upserts live in teller-sync.ts.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import {
  defaultAccountInclusion,
  parseCurrencyToCents,
  type FinanceAccountKind,
} from "@/lib/finance-accounts";
import type { FinanceAccount } from "@/generated/prisma/client";

export type SaveFinanceAccountInput = {
  id?: string;
  name: string;
  kind: FinanceAccountKind;
  includeInNetWorth?: boolean;
  includeInCashPosition?: boolean;
  currentBalance: string;
  balanceUpdatedAt: string;
  statementBalance?: string;
  dueDate?: string;
  creditLimit?: string;
};

export async function listAccounts(userId: string): Promise<FinanceAccount[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeAccount.findMany({
    where: { userId },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
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

  const defaultInclusion = defaultAccountInclusion(input.kind);
  const data = {
    name,
    kind: input.kind,
    includeInNetWorth: input.includeInNetWorth ?? defaultInclusion.includeInNetWorth,
    includeInCashPosition: input.includeInCashPosition ?? defaultInclusion.includeInCashPosition,
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
