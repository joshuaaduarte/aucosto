"use server";

import { revalidatePath } from "next/cache";
import type { FinanceCategory } from "@/lib/finance-categories";
import type { FinanceAccountKind } from "@/lib/finance-accounts";
import type {
  FinanceGoalCategory,
  FinanceGoalOwner,
  FinanceGoalStatus,
} from "@/lib/finance-goals";
import { parseTransactionsCsv } from "@/lib/csv";
import { withFinanceUser } from "@/lib/server-action";
import * as financeService from "@/lib/services/finance";

export type UploadState =
  | {
      ok: true;
      source: "csv" | "statement";
      imported: number;
      skipped: number;
      deduped: number;
      bankLabel?: string;
    }
  | { ok: false; error: string }
  | undefined;

export type AccountState =
  | { ok: true }
  | { ok: false; error: string }
  | undefined;

export type GoalState =
  | { ok: true }
  | { ok: false; error: string }
  | undefined;

export type LinkedConnectionState =
  | {
      ok: true;
      message: string;
      accountCount?: number;
      transactionCount?: number;
    }
  | { ok: false; error: string }
  | undefined;

function revalidateFinance() {
  revalidatePath("/app");
  revalidatePath("/app/finance");
}

export async function uploadCsv(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  return withFinanceUser<UploadState>(async (userId) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Pick a CSV file first." };
    }
    if (file.size > 5_000_000) {
      return { ok: false, error: "File is over 5MB; split it first." };
    }

    const text = await file.text();
    const { rows, skipped } = parseTransactionsCsv(text);

    if (rows.length === 0) {
      return {
        ok: false,
        error:
          "No transactions parsed. Need a header row with Date, Amount (or Debit/Credit), and Description.",
      };
    }

    const { imported, deduped } = await financeService.importTransactions(userId, rows);
    revalidateFinance();
    return { ok: true, source: "csv", imported, skipped, deduped };
  }, "Could not import CSV.");
}

export async function uploadStatementPdf(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  return withFinanceUser<UploadState>(async (userId) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Pick a PDF statement first." };
    }
    if (file.size > 10_000_000) {
      return { ok: false, error: "File is over 10MB; split it first." };
    }

    const result = await financeService.importStatement(userId, {
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });

    revalidateFinance();
    return {
      ok: true,
      source: "statement",
      imported: result.imported,
      skipped: result.skipped,
      deduped: result.deduped,
      bankLabel: result.bankLabel,
    };
  }, "Could not import statement PDF.");
}

export async function updateTransactionCategory(
  id: string,
  category: FinanceCategory,
) {
  await withFinanceUser(async (userId) => {
    await financeService.updateTransactionCategory(userId, id, category);
    revalidateFinance();
    return { ok: true as const };
  });
}

export async function updateMatchingTransactionCategories(
  description: string,
  account: string | null,
  category: FinanceCategory,
) {
  const result = await withFinanceUser(async (userId) => {
    const count = await financeService.updateMatchingTransactionCategories(userId, {
      description,
      account,
      category,
    });
    revalidateFinance();
    return { ok: true as const, count };
  });
  return "ok" in result && result.ok ? result.count : 0;
}

export async function deleteAllTransactions() {
  await withFinanceUser(async (userId) => {
    await financeService.deleteAllTransactions(userId);
    revalidateFinance();
    return { ok: true as const };
  });
}

export async function saveFinanceAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  return withFinanceUser<AccountState>(async (userId) => {
    await financeService.saveAccount(userId, {
      id: String(formData.get("id") ?? "").trim() || undefined,
      name: String(formData.get("name") ?? ""),
      kind: String(formData.get("kind") ?? "checking") as FinanceAccountKind,
      includeInNetWorth: formData.get("includeInNetWorth") === "on",
      includeInCashPosition: formData.get("includeInCashPosition") === "on",
      currentBalance: String(formData.get("currentBalance") ?? ""),
      balanceUpdatedAt: String(formData.get("balanceUpdatedAt") ?? ""),
      statementBalance: String(formData.get("statementBalance") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      creditLimit: String(formData.get("creditLimit") ?? ""),
    });
    revalidateFinance();
    return { ok: true };
  }, "Could not save account.");
}

export async function saveFinanceGoal(
  _prev: GoalState,
  formData: FormData,
): Promise<GoalState> {
  return withFinanceUser<GoalState>(async (userId) => {
    await financeService.saveGoal(userId, {
      id: String(formData.get("id") ?? "").trim() || undefined,
      name: String(formData.get("name") ?? ""),
      owner: String(formData.get("owner") ?? "shared") as FinanceGoalOwner,
      category: String(formData.get("category") ?? "general") as FinanceGoalCategory,
      targetAmount: String(formData.get("targetAmount") ?? ""),
      currentAmount: String(formData.get("currentAmount") ?? "0"),
      targetDate: String(formData.get("targetDate") ?? ""),
      monthlyContribution: String(formData.get("monthlyContribution") ?? ""),
      status: String(formData.get("status") ?? "active") as FinanceGoalStatus,
      notes: String(formData.get("notes") ?? ""),
    });
    revalidateFinance();
    return { ok: true };
  }, "Could not save goal.");
}

export async function linkTellerConnection(
  accessToken: string,
  enrollmentId?: string | null,
): Promise<LinkedConnectionState> {
  return withFinanceUser<LinkedConnectionState>(async (userId) => {
    const connection = await financeService.linkTellerConnection(userId, {
      accessToken,
      enrollmentId,
    });
    revalidateFinance();
    return {
      ok: true,
      message: `Linked ${connection.institutionName ?? "bank"} and synced ${connection.accountCount} account${connection.accountCount === 1 ? "" : "s"}.`,
    };
  }, "Could not link Teller connection.");
}

export async function syncLinkedFinanceConnection(
  connectionId: string,
): Promise<LinkedConnectionState> {
  return withFinanceUser<LinkedConnectionState>(async (userId) => {
    const result = await financeService.syncFinanceConnection(userId, connectionId);
    revalidateFinance();
    return {
      ok: true,
      message: `Synced ${result.accountCount} account${result.accountCount === 1 ? "" : "s"}.`,
      accountCount: result.accountCount,
      transactionCount: result.transactionCount,
    };
  }, "Could not sync linked account.");
}

export async function disconnectLinkedFinanceConnection(
  connectionId: string,
): Promise<LinkedConnectionState> {
  return withFinanceUser<LinkedConnectionState>(async (userId) => {
    await financeService.disconnectFinanceConnection(userId, connectionId);
    revalidateFinance();
    return {
      ok: true,
      message: "Disconnected linked bank sync. Imported data was left in place.",
    };
  }, "Could not disconnect linked account.");
}
