import { auth } from "@/auth";
import { calculateSpendProjection } from "@/lib/finance-pace";
import { summarizeCashflow, summarizeTransactionTypes, topCategoriesBySpend } from "@/lib/finance-summary";
import { countTransactions, listTransactions } from "@/lib/services/finance";
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
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const monthStart = startOfMonth();

  const [count, thisMonth] = await Promise.all([
    countTransactions(userId),
    listTransactions(userId, { since: monthStart, limit: 500 }),
  ]);

  const { spentCents, netCents } = summarizeCashflow(thisMonth);
  const projection = calculateSpendProjection(thisMonth);
  const cardPayments = summarizeTransactionTypes(thisMonth).find(
    (item) => item.type === "credit_card_payment",
  );
  const topCategory = topCategoriesBySpend(thisMonth, { limit: 1 })[0] ?? null;

  if (count === 0) {
    return (
      <WidgetCard name="Finance" href="/app/finance">
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight">No data yet</p>
          <p className="text-sm text-zinc-500">upload a CSV to start</p>
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard name="Finance" href="/app/finance">
      <div className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight">
          {formatUSDFromCents(spentCents)}
        </p>
        <p className="text-sm text-zinc-500">spent this month</p>
        <p className={`text-xs ${netCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}>
          {formatUSDFromCents(netCents)} net
        </p>
        {topCategory && (
          <p className="text-xs text-zinc-500">
            top: {topCategory.category}
          </p>
        )}
        <p className="text-xs text-zinc-500">
          {formatUSDFromCents(projection.projectedCents)} projected
        </p>
        {cardPayments && (
          <p className="text-xs text-zinc-500">
            {formatUSDFromCents(cardPayments.amountCents)} card payments
          </p>
        )}
      </div>
    </WidgetCard>
  );
}
