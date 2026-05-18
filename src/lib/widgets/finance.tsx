import { summarizeBalances } from "@/lib/finance-accounts";
import { calculateSpendProjection } from "@/lib/finance-pace";
import { summarizeCashflow, summarizeTransactionTypes, topCategoriesBySpend } from "@/lib/finance-summary";
import { startOfMonth, formatUSDFromCents as formatUSD } from "@/lib/money";
import { countTransactions, listAccounts, listTransactions } from "@/lib/services/finance";
import { assertFinanceVisible } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

function fmt(cents: number) {
  return formatUSD(cents, { maximumFractionDigits: 0 });
}

export async function FinanceWidget() {
  const { effectiveUserId: userId } = await assertFinanceVisible();
  const monthStart = startOfMonth();

  const [accounts, count, thisMonth] = await Promise.all([
    listAccounts(userId),
    countTransactions(userId),
    listTransactions(userId, { since: monthStart, limit: 500 }),
  ]);

  /* ── With connected accounts ─────────────────────────── */
  if (accounts.length > 0) {
    const snapshot = summarizeBalances(accounts);
    return (
      <WidgetCard name="Finance" href="/app/finance">
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-ghost">
              Net worth
            </p>
            <p
              className="mt-1.5 font-mono text-[2.5rem] font-medium leading-none tabular"
              style={{ color: "var(--ink)" }}
            >
              {fmt(snapshot.netWorthCents)}
            </p>
          </div>
          <div
            className="grid grid-cols-2 gap-3 pt-3 text-sm"
            style={{ borderTop: "1px solid var(--rule-faint)" }}
          >
            <div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-ghost">Cash</p>
              <p className="mt-1 font-mono tabular text-ink">{fmt(snapshot.cashCents)}</p>
            </div>
            <div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-ghost">Owed</p>
              <p
                className="mt-1 font-mono tabular"
                style={{ color: "var(--oxblood)" }}
              >
                {fmt(snapshot.cardsOwedCents)}
              </p>
            </div>
          </div>
          {(snapshot.investmentCents > 0 || snapshot.retirementCents > 0) && (
            <p className="text-xs text-ink-ghost">
              <span className="font-mono tabular text-ink-fade">
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
          <p className="text-base font-medium text-ink">No entries yet.</p>
          <p className="text-sm leading-relaxed text-ink-fade">
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
      <div className="space-y-4">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-ghost">
            True spend, MTD
          </p>
          <p
            className="mt-1.5 font-mono text-[2.5rem] font-medium leading-none tabular"
            style={{ color: "var(--oxblood)" }}
          >
            {fmt(spentCents)}
          </p>
        </div>
        <div
          className="grid grid-cols-2 gap-3 pt-3"
          style={{ borderTop: "1px solid var(--rule-faint)" }}
        >
          <div>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-ghost">Net</p>
            <p
              className="mt-1 font-mono text-sm tabular"
              style={{ color: netCents >= 0 ? "var(--verdigris)" : "var(--oxblood)" }}
            >
              {fmt(netCents)}
            </p>
          </div>
          <div>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-ghost">Pace</p>
            <p className="mt-1 font-mono text-sm tabular text-ink">
              {fmt(projection.projectedCents)}
            </p>
          </div>
        </div>
        {topCategory && (
          <p className="text-xs text-ink-ghost">
            Top: <span className="font-medium text-ink-fade">{topCategory.category}</span>
            {cardPayments && (
              <>
                {" · "}
                <span className="font-mono tabular">{fmt(cardPayments.amountCents)}</span>
                {" cleared on cards"}
              </>
            )}
          </p>
        )}
      </div>
    </WidgetCard>
  );
}
