"use server";

// Data for the "+" quick-capture sheet, loaded when the sheet opens (not on
// every page render): accounts, shops you've used, your categories, your
// shared lists, Home chores and recent timer labels. Every read degrades to empty, so the
// sheet still opens if one tool's data can't load.

import { lastUsedAccountId, merchantSuggestions, type MerchantSuggestion } from "@/lib/finance-entries";
import { spendCategoryChoices } from "@/lib/finance-categories";
import { isMoveEntry } from "@/lib/finance-moves";
import { homeDaysUntil, homeDueLabel } from "@/lib/home";
import { choresToOffer, rankCategories, recentTimerLabels } from "@/lib/quick-capture";
import { listAccounts, listTransactions } from "@/lib/services/finance";
import { isHomeReady, listHomeLists, listHomeTasks } from "@/lib/services/home";
import { listRecentEntries } from "@/lib/services/time";
import { getViewerContext } from "@/lib/viewer-context";

export type QuickCaptureData = {
  finance: {
    accounts: Array<{ id: string; name: string; kind: string }>;
    merchants: MerchantSuggestion[];
    defaultAccountId: string | null;
    categories: string[];
  } | null;
  lists: Array<{ id: string; name: string; emoji: string | null; open: number }>;
  /** Home chores and upkeep, due soonest first (for "Chore done"). */
  chores: Array<{ id: string; title: string; daysUntil: number; dueLabel: string }>;
  timers: Array<{ label: string; category: string | null }>;
};

export async function loadQuickCapture(): Promise<QuickCaptureData> {
  const context = await getViewerContext();
  if (!context) return { finance: null, lists: [], chores: [], timers: [] };
  const isPartner = context.role === "partner";

  const homeReady = isHomeReady(context.homeUserId).catch(() => false);
  const [finance, lists, chores, timers] = await Promise.all([
    context.financeVisible
      ? Promise.all([
          listAccounts(context.financeUserId),
          listTransactions(context.financeUserId, { limit: 500 }),
        ])
          .then(([accounts, history]) => {
            const spending = history.filter((tx) => !isMoveEntry(tx));
            return {
              accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
              merchants: merchantSuggestions(spending, 40),
              defaultAccountId:
                lastUsedAccountId(history, context.ownerUserId) ??
                accounts.find((a) => a.kind === "credit_card")?.id ??
                accounts.find((a) => a.kind === "checking")?.id ??
                null,
              categories: rankCategories(spendCategoryChoices(history), spending),
            };
          })
          .catch((error) => {
            console.error("[quick-capture] finance read failed", error);
            return null;
          })
      : Promise.resolve(null),
    homeReady
      .then((ready) => (ready ? listHomeLists(context.homeUserId) : []))
      .then((rows) =>
        rows.map((list) => ({
          id: list.id,
          name: list.name,
          emoji: list.emoji,
          open: list.items.filter((item) => item.checkedAt == null).length,
        })),
      )
      .catch(() => []),
    homeReady
      .then((ready) => (ready ? listHomeTasks(context.homeUserId) : []))
      .then((tasks) => {
        const now = new Date();
        return choresToOffer(
          tasks.map((task) => ({ id: task.id, title: task.title, daysUntil: homeDaysUntil(task.nextDueAt, now) })),
        ).map((task) => ({ ...task, dueLabel: homeDueLabel(task.daysUntil) }));
      })
      .catch(() => []),
    isPartner
      ? Promise.resolve([])
      : listRecentEntries(context.effectiveUserId, { limit: 40 })
          .then((entries) => recentTimerLabels(entries))
          .catch(() => []),
  ]);

  return { finance, lists, chores, timers };
}
