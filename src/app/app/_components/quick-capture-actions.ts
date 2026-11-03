"use server";

// Data for the "+" quick-capture sheet, loaded when the sheet opens (not on
// every page render): accounts, shops you've used, your categories, your
// shared lists, Home chores, recent timer labels, today's habits, whether
// today is reflected, people and the Work workspace. Every read degrades to empty, so the
// sheet still opens if one tool's data can't load.

import { lastUsedAccountId, merchantSuggestions, type MerchantSuggestion } from "@/lib/finance-entries";
import { spendCategoryChoices } from "@/lib/finance-categories";
import { isMoveEntry } from "@/lib/finance-moves";
import { homeDaysUntil, homeDueLabel } from "@/lib/home";
import { choresToOffer, habitsToOffer, rankCategories, recentTimerLabels } from "@/lib/quick-capture";
import { dayKey } from "@/lib/reflect";
import { listHabits } from "@/lib/services/habits";
import { getReflection } from "@/lib/services/reflect";
import { listPersons } from "@/lib/services/rolodex";
import { getDefaultWorkspace, listAreas, listProjects } from "@/lib/services/work";
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
  /** Habits due today and not yet done. */
  habits: Array<{ id: string; title: string; targetLabel: string }>;
  reflectedToday: boolean;
  people: Array<{ id: string; name: string; lastAt: string | null }>;
  /** Null until Work is set up (a workspace with at least one area or project). */
  work: { workspaceId: string; projects: Array<{ id: string; name: string }> } | null;
};


async function loadWork(userId: string): Promise<QuickCaptureData["work"]> {
  const workspace = await getDefaultWorkspace(userId);
  if (!workspace) return null;
  const [areas, projects] = await Promise.all([listAreas(userId, workspace.id), listProjects(userId, workspace.id)]);
  if (areas.length === 0 && projects.length === 0) return null;
  return {
    workspaceId: workspace.id,
    projects: projects
      .filter((project) => project.status !== "done")
      .slice(0, 8)
      .map((project) => ({ id: project.id, name: project.name })),
  };
}

export async function loadQuickCapture(): Promise<QuickCaptureData> {
  const context = await getViewerContext();
  if (!context) {
    return { finance: null, lists: [], chores: [], timers: [], habits: [], reflectedToday: false, people: [], work: null };
  }
  const isPartner = context.role === "partner";

  const homeReady = isHomeReady(context.homeUserId).catch(() => false);
  const owner = !isPartner;
  const now = new Date();
  const userId = context.effectiveUserId;
  const [finance, lists, chores, timers, habits, reflectedToday, people, work] = await Promise.all([
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
    owner
      ? listHabits(userId)
          .then((rows) =>
            habitsToOffer(rows, now.getHours()).map((habit) => ({
              id: habit.id,
              title: habit.title,
              targetLabel: habit.targetLabel,
            })),
          )
          .catch(() => [])
      : Promise.resolve([]),
    owner
      ? getReflection(userId, dayKey(now))
          .then((row) => row !== null)
          .catch(() => false)
      : Promise.resolve(false),
    owner
      ? listPersons(userId)
          .then((rows) => rows.map((person) => ({ id: person.id, name: person.displayName, lastAt: person.lastInteractionAt })))
          .catch(() => [])
      : Promise.resolve([]),
    owner ? loadWork(userId).catch(() => null) : Promise.resolve(null),
  ]);

  return { finance, lists, chores, timers, habits, reflectedToday, people, work };
}
