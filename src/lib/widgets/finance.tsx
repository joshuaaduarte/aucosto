import { summarizeBalances } from "@/lib/finance-accounts";
import { calculateSpendProjection } from "@/lib/finance-pace";
import { summarizeCashflow, summarizeTransactionTypes, topCategoriesBySpend } from "@/lib/finance-summary";
import { countTransactions, listAccounts, listTransactions } from "@/lib/services/finance";
import { assertFinanceVisible } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatUSDFromCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export async function FinanceWidget() {
  const { effectiveUserId: userId } = await assertFinanceVisible();
  const monthStart = startOfMonth();

  const [accounts, count, thisMonth] = await Promise.all([
    listAccounts(userId),
    countTransactions(userId),
    listTransactions(userId, { since: monthStart, limit: 500 }),
  ]);

  if (accounts.length > 0) {
    const snapshot = summarizeBalances(accounts);
    return (
      <WidgetCard name="Finance" href="/app/finance">
        <div className="space-y-4">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-zinc-950">
              {formatUSDFromCents(snapshot.netWorthCents)}
            </p>
            <p className="mt-1 text-sm text-zinc-500">net worth</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/90 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Cash</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{formatUSDFromCents(snapshot.cashCents)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/90 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Cards owed</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{formatUSDFromCents(snapshot.cardsOwedCents)}</p>
            </div>
          </div>
          {(snapshot.investmentCents > 0 || snapshot.retirementCents > 0) && (
            <p className="text-xs text-zinc-500">
              {formatUSDFromCents(snapshot.investmentCents + snapshot.retirementCents)} in long-term accounts
            </p>
          )}
        </div>
      </WidgetCard>
    );
  }

  if (count === 0) {
    return (
      <WidgetCard name="Finance" href="/app/finance">
        <div className="space-y-3">
          <p className="text-2xl font-semibold tracking-tight text-zinc-950">No data yet</p>
          <p className="text-sm text-zinc-500">Upload a CSV, import a statement PDF, or add an account.</p>
        </div>
      </WidgetCard>
    );
  }

  const { spentCents, netCents } = summarizeCashflow(thisMonth);
  const projection = calculateSpendProjection(thisMonth);
  const cardPayments = summarizeTransactionTypes(thisMonth).find(
    (item) => item.type === "credit_card_payment",
  );
  const topCategory = topCategoriesBySpend(thisMonth, { limit: 1 })[0] ?? null;

  return (
    <WidgetCard name="Finance" href="/app/finance">
      <div className="space-y-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-zinc-950">
            {formatUSDFromCents(spentCents)}
          </p>
          <p className="mt-1 text-sm text-zinc-500">true spend this month</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${netCents >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
            {formatUSDFromCents(netCents)} net
          </span>
          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            {formatUSDFromCents(projection.projectedCents)} projected
          </span>
        </div>
        {topCategory && (
          <p className="text-sm text-zinc-500">
            Top category: <span className="font-medium text-zinc-900">{topCategory.category}</span>
          </p>
        )}
        {cardPayments && (
          <p className="text-xs text-zinc-500">
            {formatUSDFromCents(cardPayments.amountCents)} in card payments this month
          </p>
        )}
      </div>
    </WidgetCard>
  );
}
