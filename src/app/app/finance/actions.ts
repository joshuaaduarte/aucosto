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
import { parseCurrencyToCents } from "@/lib/finance-accounts";
import { setFinanceScope } from "../settings/household-actions";
import * as financeService from "@/lib/services/finance";
import { z } from "zod";
import { currentActorUserId } from "@/lib/actor";
import { parseAmountInput } from "@/lib/finance-entries";
import { FLEXIBLE_BUDGET_KEY } from "@/lib/finance-pacing";
import { formatUSDFromCents } from "@/lib/money";
import { parseStatementPdf } from "@/lib/statement-import";

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

// ── Budgets, bills, money date ───────────────────────────────────────────

export type PlanningState = { ok: true; message?: string } | { ok: false; error: string } | undefined;

/** "YYYY-MM-DD" → local noon (server TZ is pinned to the owner's zone). */
function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(Number.NaN);
  return new Date(`${value}T12:00:00`);
}

export async function saveFinanceBudget(
  _prev: PlanningState,
  formData: FormData,
): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    await financeService.saveBudget(userId, {
      category: String(formData.get("category") ?? ""),
      monthlyLimitCents: parseCurrencyToCents(String(formData.get("limit") ?? "")),
    });
    revalidateFinance();
    return { ok: true, message: "Budget saved." };
  }, "Could not save budget.");
}

export async function deleteFinanceBudget(id: string): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    await financeService.deleteBudget(userId, id);
    revalidateFinance();
    return { ok: true };
  }, "Could not remove budget.");
}

export async function saveFinanceBill(
  _prev: PlanningState,
  formData: FormData,
): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    const amount = String(formData.get("amount") ?? "").trim();
    await financeService.saveBill(userId, {
      id: String(formData.get("id") ?? "").trim() || undefined,
      name: String(formData.get("name") ?? ""),
      amountCents: amount ? parseCurrencyToCents(amount) : null,
      cadence: String(formData.get("cadence") ?? "monthly"),
      nextDueAt: parseDateOnly(String(formData.get("nextDueAt") ?? "")),
      category: String(formData.get("category") ?? "") || null,
      autopay: formData.get("autopay") === "on",
      notes: String(formData.get("notes") ?? ""),
    });
    revalidateFinance();
    return { ok: true, message: "Bill saved." };
  }, "Could not save bill.");
}

export async function markFinanceBillPaid(id: string): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    await financeService.markBillPaid(userId, id);
    revalidateFinance();
    return { ok: true };
  }, "Could not mark the bill paid.");
}

export async function archiveFinanceBill(id: string): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    await financeService.archiveBill(userId, id);
    revalidateFinance();
    return { ok: true };
  }, "Could not remove the bill.");
}

export async function completeMoneyDate(weekKey: string): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) throw new Error("Bad week.");
    await financeService.markMoneyDateDone(userId, weekKey);
    revalidateFinance();
    return { ok: true };
  }, "Could not save.");
}

export async function switchFinanceScope(scope: "household" | "personal"): Promise<void> {
  await setFinanceScope(scope);
  revalidateFinance();
}

// ── Day-to-day tracking: quick add, edits, balances, projection, statements ──

export type EntryInput = {
  amount: string;
  direction: "out" | "in";
  description: string;
  category: string | null;
  accountId: string | null;
  /** "YYYY-MM-DD" in the viewer's own calendar. */
  date: string;
};

export type EntryResult =
  | { ok: true; id: string; summary: string }
  | { ok: false; error: string };

function entryFields(input: EntryInput) {
  const amountCents = parseAmountInput(input.amount);
  if (amountCents === null) throw new Error("Enter an amount, like 12.50.");
  return {
    amountCents,
    direction: input.direction === "in" ? ("in" as const) : ("out" as const),
    description: input.description,
    category: input.category,
    financeAccountId: input.accountId || null,
    date: parseDateOnly(input.date),
  };
}

export async function addFinanceEntry(input: EntryInput): Promise<EntryResult> {
  return withFinanceUser<EntryResult>(async (userId) => {
    const entry = await financeService.addEntry(userId, entryFields(input));
    revalidateFinance();
    const amount = formatUSDFromCents(Math.abs(entry.amount));
    return {
      ok: true,
      id: entry.id,
      summary:
        entry.amount < 0 ? `Logged ${amount} at ${entry.description}` : `Logged ${amount} coming in`,
    };
  }, "Could not log that.");
}

export async function updateFinanceEntry(id: string, input: EntryInput): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    await financeService.updateEntry(userId, id, entryFields(input));
    revalidateFinance();
    return { ok: true };
  }, "Could not save the change.");
}

export async function deleteFinanceEntry(id: string): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    await financeService.deleteEntry(userId, id);
    revalidateFinance();
    return { ok: true };
  }, "Could not remove it.");
}

export async function setEntryCategory(id: string, category: string | null): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    await financeService.updateEntry(userId, id, { category });
    revalidateFinance();
    return { ok: true };
  }, "Could not save the category.");
}

export async function updateFinanceBalance(
  _prev: PlanningState,
  formData: FormData,
): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    await financeService.updateAccountBalance(
      userId,
      String(formData.get("accountId") ?? ""),
      parseCurrencyToCents(String(formData.get("balance") ?? "")),
      parseDateOnly(String(formData.get("asOf") ?? "")),
    );
    revalidateFinance();
    return { ok: true, message: "Balance updated." };
  }, "Could not update the balance.");
}

export async function saveFlexibleBudget(
  _prev: PlanningState,
  formData: FormData,
): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    const cents = parseCurrencyToCents(String(formData.get("limit") ?? ""));
    await financeService.saveBudget(userId, { category: FLEXIBLE_BUDGET_KEY, monthlyLimitCents: cents });
    revalidateFinance();
    return { ok: true, message: "Saved." };
  }, "Could not save.");
}

export async function saveFinanceAccountPlan(
  _prev: PlanningState,
  formData: FormData,
): Promise<PlanningState> {
  return withFinanceUser<PlanningState>(async (userId) => {
    const rate = String(formData.get("rate") ?? "").replace(/[%\s]/g, "");
    const rateNumber = rate === "" ? 0 : Number(rate);
    if (!Number.isFinite(rateNumber)) throw new Error("Enter a yearly rate like 6.");
    await financeService.saveAccountPlan(userId, String(formData.get("accountId") ?? ""), {
      monthlyContributionCents: parseCurrencyToCents(String(formData.get("monthly") ?? "")),
      annualGrowthBps: Math.round(rateNumber * 100),
    });
    revalidateFinance();
    return { ok: true, message: "Saved." };
  }, "Could not save.");
}

export type StatementLineView = { key: string; date: string; amount: number; description: string };

export type StatementPreviewState =
  | {
      ok: true;
      accountId: string;
      kind: string;
      lines: StatementLineView[];
      entries: Array<{ id: string; date: string; amount: number; description: string }>;
      matched: Array<{ lineKey: string; entryId: string }>;
      nearMisses: Array<{ lineKey: string; entryId: string }>;
      statementOnly: string[];
      entriesOnly: string[];
      periodStart: string;
      periodEnd: string;
      suggestedOpening: string | null;
    }
  | { ok: false; error: string }
  | undefined;

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function previewStatement(
  _prev: StatementPreviewState,
  formData: FormData,
): Promise<StatementPreviewState> {
  return withFinanceUser<StatementPreviewState>(async (userId) => {
    const accountId = String(formData.get("accountId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Pick the statement file first (CSV or PDF)." };
    }
    if (file.size > 10_000_000) return { ok: false, error: "That file is over 10MB." };
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const rows = isPdf
      ? parseStatementPdf({
          fileName: file.name,
          mimeType: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        }).rows
      : parseTransactionsCsv(await file.text()).rows;
    if (rows.length === 0) {
      return {
        ok: false,
        error: isPdf
          ? "Couldn't read transactions from that PDF. Try the CSV download from your bank."
          : "Couldn't find transactions. The CSV needs Date, Amount (or Debit/Credit) and Description columns.",
      };
    }
    const preview = await financeService.previewStatementCheck(userId, accountId, rows);
    return {
      ok: true,
      accountId,
      kind: preview.account.kind,
      lines: preview.lines.map((l) => ({ key: l.key, date: l.date.toISOString(), amount: l.amount, description: l.description })),
      entries: preview.entries.map((e) => ({ id: e.id, date: e.date.toISOString(), amount: e.amount, description: e.description })),
      matched: preview.match.matched,
      nearMisses: preview.match.nearMisses,
      statementOnly: preview.match.statementOnly,
      entriesOnly: preview.match.entriesOnly,
      periodStart: toDateKey(preview.periodStart),
      periodEnd: toDateKey(preview.periodEnd),
      suggestedOpening:
        preview.suggestedOpeningCents == null ? null : (preview.suggestedOpeningCents / 100).toFixed(2),
    };
  }, "Could not read that statement.");
}

const lineSchema = z.object({
  key: z.string().min(1).max(64),
  date: z.string().datetime({ offset: true }),
  amount: z.number().int(),
  description: z.string().max(200),
});

const commitSchema = z.object({
  accountId: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  opening: z.string(),
  closing: z.string(),
  matches: z.array(z.object({ entryId: z.string().min(1), line: lineSchema })).max(2000),
  additions: z.array(lineSchema).max(2000),
  notOnStatement: z.array(z.string().min(1)).max(2000),
  allowAdjustment: z.boolean(),
});

export type CommitStatementResult =
  | { ok: true; differenceCents: number }
  | { ok: false; error: string };

export async function commitStatement(payload: z.input<typeof commitSchema>): Promise<CommitStatementResult> {
  return withFinanceUser<CommitStatementResult>(async (userId) => {
    const input = commitSchema.parse(payload);
    const toLine = (l: z.infer<typeof lineSchema>) => ({ ...l, date: new Date(l.date) });
    const result = await financeService.commitStatementCheck(userId, {
      accountId: input.accountId,
      periodStart: parseDateOnly(input.periodStart),
      periodEnd: parseDateOnly(input.periodEnd),
      openingCents: parseCurrencyToCents(input.opening),
      closingCents: parseCurrencyToCents(input.closing),
      matches: input.matches.map((m) => ({ entryId: m.entryId, line: toLine(m.line) })),
      additions: input.additions.map(toLine),
      notOnStatement: input.notOnStatement,
      allowAdjustment: input.allowAdjustment,
    });
    revalidateFinance();
    return { ok: true, differenceCents: result.differenceCents };
  }, "Could not finish the check.");
}

export type ShortcutKeyState = { ok: true; key: string } | { ok: false; error: string } | undefined;

/** A new personal key for the iPhone Shortcut; older keys stop working. */
export async function createFinanceShortcutKey(): Promise<ShortcutKeyState> {
  return withFinanceUser<ShortcutKeyState>(async () => {
    const person = currentActorUserId();
    if (!person) throw new Error("Not signed in.");
    return { ok: true, key: await financeService.createShortcutKey(person) };
  }, "Could not make a key.");
}
