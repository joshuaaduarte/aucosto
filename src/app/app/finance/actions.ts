"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import type { FinanceCategory } from "@/lib/finance-categories";
import type { FinanceAccountKind } from "@/lib/finance-accounts";
import { parseTransactionsCsv } from "@/lib/csv";
import * as financeService from "@/lib/services/finance";

export type UploadState =
  | { ok: true; imported: number; skipped: number; deduped: number }
  | { ok: false; error: string }
  | undefined;

export type AccountState =
  | { ok: true }
  | { ok: false; error: string }
  | undefined;

export async function uploadCsv(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in." };

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

  const { imported, deduped } = await financeService.importTransactions(
    session.user.id,
    rows,
  );

  revalidatePath("/app");
  revalidatePath("/app/finance");
  return { ok: true, imported, skipped, deduped };
}

export async function updateTransactionCategory(
  id: string,
  category: FinanceCategory,
) {
  const session = await auth();
  if (!session?.user?.id) return;

  await financeService.updateTransactionCategory(session.user.id, id, category);

  revalidatePath("/app");
  revalidatePath("/app/finance");
}

export async function deleteAllTransactions() {
  const session = await auth();
  if (!session?.user?.id) return;

  await financeService.deleteAllTransactions(session.user.id);

  revalidatePath("/app");
  revalidatePath("/app/finance");
}

export async function saveFinanceAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in." };

  try {
    await financeService.saveAccount(session.user.id, {
      id: String(formData.get("id") ?? "").trim() || undefined,
      name: String(formData.get("name") ?? ""),
      kind: String(formData.get("kind") ?? "checking") as FinanceAccountKind,
      currentBalance: String(formData.get("currentBalance") ?? ""),
      balanceUpdatedAt: String(formData.get("balanceUpdatedAt") ?? ""),
      statementBalance: String(formData.get("statementBalance") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      creditLimit: String(formData.get("creditLimit") ?? ""),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save account.",
    };
  }

  revalidatePath("/app");
  revalidatePath("/app/finance");
  return { ok: true };
}
