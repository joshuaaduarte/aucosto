// Sort one at a time: each unsorted purchase gets its own card with big
// category buttons. One tap files it and the next one appears.

import Link from "next/link";
import { redirect } from "next/navigation";
import { householdMemberNames } from "@/lib/household";
import { spendCategoryChoices } from "@/lib/finance-categories";
import { buildSortQueue } from "@/lib/finance-sort";
import { rankCategories } from "@/lib/quick-capture";
import { listAccounts, listTransactions } from "@/lib/services/finance";
import { requireViewerContext } from "@/lib/viewer-context";
import { SortFlow } from "./sort-flow";

export const dynamic = "force-dynamic";

export default async function SortPage() {
  const context = await requireViewerContext();
  if (!context.financeVisible) redirect("/app");
  const userId = context.financeUserId;
  const [accounts, history, names] = await Promise.all([
    listAccounts(userId),
    listTransactions(userId, { limit: 2000 }),
    context.householdId
      ? householdMemberNames(context.householdId).catch(() => ({}) as Record<string, string>)
      : Promise.resolve({} as Record<string, string>),
  ]);
  const queue = buildSortQueue({
    history,
    accountNames: Object.fromEntries(accounts.map((a) => [a.id, a.name])),
    names,
  });
  const categories = rankCategories(spendCategoryChoices(history), history);

  return (
    <div className="mx-auto max-w-md space-y-5 pb-10">
      <Link href="/app/finance" className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        ← Finance
      </Link>
      <SortFlow initialQueue={queue} categories={categories} />
    </div>
  );
}
