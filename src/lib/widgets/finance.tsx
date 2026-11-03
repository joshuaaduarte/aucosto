import { summarizeBalances } from "@/lib/finance-accounts";
import { calculateSpendProjection } from "@/lib/finance-pace";
import {
  summarizeCashflow,
  summarizeTransactionTypes,
  topCategoriesBySpend,
} from "@/lib/finance-summary";
import { startOfMonth, formatUSDFromCents as formatUSD } from "@/lib/money";
import {
  countTransactions,
  listAccounts,
  listBills,
  listBudgets,
  listTransactions,
} from "@/lib/services/finance";
import { FLEXIBLE_BUDGET_KEY, buildPacing } from "@/lib/finance-pacing";
import { assertFinanceVisible } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

// Read outside the component body (react-hooks/purity).
function currentTime(): Date {
  return new Date();
}

function fmt(cents: number) {
  return formatUSD(cents, { maximumFractionDigits: 0 });
}

export async function FinanceWidget() {
  const { financeUserId: userId } = await assertFinanceVisible();
  const monthStart = startOfMonth();

  const [accounts, count, thisMonth, budgets, bills] = await Promise.all([
    listAccounts(userId),
    countTransactions(userId),
    listTransactions(userId, { since: monthStart, limit: 1000 }),
    listBudgets(userId),
    listBills(userId),
  ]);
  const flexible = budgets.find((b) => b.category === FLEXIBLE_BUDGET_KEY);
  const pace = flexible
    ? buildPacing({
        flexibleLimitCents: flexible.monthlyLimitCents,
        transactions: thisMonth,
        bills,
        now: currentTime(),
      })
    : null;
  const paceLine = pace ? (
    <div className="pb-2" style={{ borderBottom: "1px solid var(--border-faint)" }}>
      <p className="text-[1.125rem] font-semibold tracking-tight tabular" style={{ color: "var(--text)" }}>
        {pace.week.leftCents >= 0
          ? `${fmt(pace.week.leftCents)} left this week`
          : `${fmt(-pace.week.leftCents)} over this week`}
      </p>
      <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {fmt(pace.month.spentCents)} of {fmt(pace.limitCents ?? 0)} this month · tap to log spending
      </p>
    </div>
  ) : null;

  /* ── With connected accounts ─────────────────────────── */
  if (accounts.length > 0) {
    const snapshot = summarizeBalances(accounts);
    return (
      <WidgetCard name="Money" href="/app/finance">
        <div className="space-y-3">
          {paceLine}
          <div>
            <p
              className="text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Net worth
            </p>
            <p
              className="mt-0.5 text-[1.625rem] font-semibold tracking-tight tabular"
              style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
            >
              {fmt(snapshot.netWorthCents)}
            </p>
          </div>
          <div
            className="grid grid-cols-2 gap-3 pt-2"
            style={{ borderTop: "1px solid var(--border-faint)" }}
          >
            <div>
              <p
                className="text-[0.6875rem] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                Cash
              </p>
              <p
                className="mt-0.5 text-[0.875rem] tabular font-medium"
                style={{ color: "var(--text)" }}
              >
                {fmt(snapshot.cashCents)}
              </p>
            </div>
            <div>
              <p
                className="text-[0.6875rem] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                Owed
              </p>
              <p
                className="mt-0.5 text-[0.875rem] tabular font-medium"
                style={{ color: "var(--accent-strong)" }}
              >
                {fmt(snapshot.cardsOwedCents)}
              </p>
            </div>
          </div>
          {(snapshot.investmentCents > 0 || snapshot.retirementCents > 0) && (
            <p
              className="text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
              <span
                className="tabular"
                style={{ color: "var(--text-muted)" }}
              >
                {fmt(snapshot.investmentCents + snapshot.retirementCents)}
              </span>{" "}
              in long-term positions
            </p>
          )}
        </div>
      </WidgetCard>
    );
  }

  /* ── No data yet ─────────────────────────────────────── */
  if (count === 0) {
    return (
      <WidgetCard name="Finance" href="/app/finance">
        <div className="space-y-2">
          <p
            className="text-[0.9375rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            No entries yet.
          </p>
          <p
            className="text-[0.8125rem] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Import a statement or upload a CSV to get started.
          </p>
        </div>
      </WidgetCard>
    );
  }

  /* ── Transactions but no accounts ───────────────────── */
  const { spentCents, netCents } = summarizeCashflow(thisMonth);
  const projection = calculateSpendProjection(thisMonth);
  const cardPayments = summarizeTransactionTypes(thisMonth).find(
    (item) => item.type === "credit_card_payment",
  );
  const topCategory = topCategoriesBySpend(thisMonth, { limit: 1 })[0] ?? null;

  return (
    <WidgetCard name="Finance" href="/app/finance">
      <div className="space-y-3">
        <div>
          <p
            className="text-[0.6875rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            True spend, MTD
          </p>
          <p
            className="mt-0.5 text-[1.625rem] font-semibold tracking-tight tabular"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            {fmt(spentCents)}
          </p>
        </div>
        <div
          className="grid grid-cols-2 gap-3 pt-2"
          style={{ borderTop: "1px solid var(--border-faint)" }}
        >
          <div>
            <p
              className="text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Net
            </p>
            <p
              className="mt-0.5 text-[0.875rem] tabular font-medium"
              style={{
                color:
                  netCents >= 0
                    ? "var(--text)"
                    : "var(--accent-strong)",
              }}
            >
              {fmt(netCents)}
            </p>
          </div>
          <div>
            <p
              className="text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Pace
            </p>
            <p
              className="mt-0.5 text-[0.875rem] tabular font-medium"
              style={{ color: "var(--text)" }}
            >
              {fmt(projection.projectedCents)}
            </p>
          </div>
        </div>
        {topCategory && (
          <p
            className="text-[0.75rem]"
            style={{ color: "var(--text-faint)" }}
          >
            Top:{" "}
            <span style={{ color: "var(--text-muted)" }}>
              {topCategory.category}
            </span>
            {cardPayments && (
              <>
                {" · "}
                <span className="tabular">{fmt(cardPayments.amountCents)}</span>
                {" cleared on cards"}
              </>
            )}
          </p>
        )}
      </div>
    </WidgetCard>
  );
}
