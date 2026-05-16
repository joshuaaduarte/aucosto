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
import * as financeService from "@/lib/services/finance";
import { assertFinanceVisible } from "@/lib/viewer-context";

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

async function getFinanceUserId(): Promise<string> {
  const context = await assertFinanceVisible();
  return context.effectiveUserId;
}

export async function uploadCsv(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  let userId: string;
  try {
    userId = await getFinanceUserId();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not signed in." };
  }

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
}

export async function uploadStatementPdf(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  let userId: string;
  try {
    userId = await getFinanceUserId();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not signed in." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a PDF statement first." };
  }
  if (file.size > 10_000_000) {
    return { ok: false, error: "File is over 10MB; split it first." };
  }

  try {
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
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not import statement PDF.",
    };
  }
}

export async function updateTransactionCategory(
  id: string,
  category: FinanceCategory,
) {
  const userId = await getFinanceUserId();
  await financeService.updateTransactionCategory(userId, id, category);
  revalidateFinance();
}

export async function updateMatchingTransactionCategories(
  description: string,
  account: string | null,
  category: FinanceCategory,
) {
  const userId = await getFinanceUserId();
  const count = await financeService.updateMatchingTransactionCategories(userId, {
    description,
    account,
    category,
  });

  revalidateFinance();
  return count;
}

export async function deleteAllTransactions() {
  const userId = await getFinanceUserId();
  await financeService.deleteAllTransactions(userId);
  revalidateFinance();
}

export async function saveFinanceAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  let userId: string;
  try {
    userId = await getFinanceUserId();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not signed in." };
  }

  try {
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
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not save account.",
    };
  }

  revalidateFinance();
  return { ok: true };
}

export async function saveFinanceGoal(
  _prev: GoalState,
  formData: FormData,
): Promise<GoalState> {
  let userId: string;
  try {
    userId = await getFinanceUserId();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not signed in." };
  }

  try {
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
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save goal.",
    };
  }

  revalidateFinance();
  return { ok: true };
}

export async function linkTellerConnection(
  accessToken: string,
  enrollmentId?: string | null,
): Promise<LinkedConnectionState> {
  let userId: string;
  try {
    userId = await getFinanceUserId();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not signed in." };
  }

  try {
    const connection = await financeService.linkTellerConnection(userId, {
      accessToken,
      enrollmentId,
    });

    revalidateFinance();
    return {
      ok: true,
      message: `Linked ${connection.institutionName ?? "bank"} and synced ${connection.accountCount} account${connection.accountCount === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not link Teller connection.",
    };
  }
}

export async function syncLinkedFinanceConnection(
  connectionId: string,
): Promise<LinkedConnectionState> {
  let userId: string;
  try {
    userId = await getFinanceUserId();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not signed in." };
  }

  try {
    const result = await financeService.syncFinanceConnection(userId, connectionId);
    revalidateFinance();
    return {
      ok: true,
      message: `Synced ${result.accountCount} account${result.accountCount === 1 ? "" : "s"}.`,
      accountCount: result.accountCount,
      transactionCount: result.transactionCount,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not sync linked account.",
    };
  }
}

export async function disconnectLinkedFinanceConnection(
  connectionId: string,
): Promise<LinkedConnectionState> {
  let userId: string;
  try {
    userId = await getFinanceUserId();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not signed in." };
  }

  try {
    await financeService.disconnectFinanceConnection(userId, connectionId);
    revalidateFinance();
    return {
      ok: true,
      message: "Disconnected linked bank sync. Imported data was left in place.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not disconnect linked account.",
    };
  }
}
