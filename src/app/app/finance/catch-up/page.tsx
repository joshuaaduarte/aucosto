// Type in today's balances on one screen.
//   /app/finance/catch-up             catch up after a gap (every account)
//   /app/finance/catch-up?only=invest monthly check-in (savings, 401k, brokerage)

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewerContext } from "@/lib/viewer-context";
import { listAccountPlans, listAccounts, listTransactions } from "@/lib/services/finance";
import { checkInRows, countPendingBefore } from "@/lib/finance-routine";
import { isLiabilityAccountKind } from "@/lib/finance-moves";
import { BalanceCheckIn } from "../_components/balance-check-in";

export const dynamic = "force-dynamic";

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function CatchUpPage({
  searchParams,
}: {
  searchParams: Promise<{ only?: string }>;
}) {
  const context = await requireViewerContext();
  if (!context.financeVisible) redirect("/app");
  const { only } = await searchParams;
  const mode = only === "invest" ? "monthly" : "catch_up";
  const userId = context.financeUserId;
  const [accounts, plans, history] = await Promise.all([
    listAccounts(userId),
    listAccountPlans(userId),
    listTransactions(userId, { limit: 2000 }),
  ]);
  const now = new Date();
  const rows = checkInRows({
    accounts,
    plans: plans.plans,
    history,
    now,
    onlyCheckIn: mode === "monthly",
  }).map(({ updatedAt, ...row }) => ({
    ...row,
    updatedLabel: updatedAt.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: updatedAt.getFullYear() === now.getFullYear() ? undefined : "numeric",
    }),
    owed: isLiabilityAccountKind(row.kind),
    card:
      mode === "catch_up" && row.kind === "credit_card"
        ? (() => {
            const a = accounts.find((x) => x.id === row.id)!;
            return {
              statementCents: a.statementBalanceCents,
              dueDay: a.dueDate ? dayKey(a.dueDate) : null,
            };
          })()
        : null,
  }));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const confirmBefore =
    mode === "catch_up"
      ? {
          day: dayKey(monthStart),
          label: monthStart.toLocaleDateString([], { month: "long", day: "numeric" }),
          count: countPendingBefore(history, monthStart),
        }
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div>
        <Link href="/app/finance" className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          ← Finance
        </Link>
        <h1 className="mt-2 text-[1.5rem] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          {mode === "monthly" ? "Monthly balance check-in" : "Catch up"}
        </h1>
        <p className="mt-1 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          {mode === "monthly"
            ? "Open each app, type in today's total. About 5 minutes, once a month."
            : "No need to enter the months you missed. Type in what each account says today and start fresh from here."}
        </p>
      </div>
      <BalanceCheckIn rows={rows} mode={mode} confirmBefore={confirmBefore} />
    </div>
  );
}
