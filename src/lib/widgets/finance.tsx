import { summarizeBalances } from "@/lib/finance-accounts";
import { calculateSpendProjection } from "@/lib/finance-pace";
import { summarizeCashflow, summarizeTransactionTypes, topCategoriesBySpend } from "@/lib/finance-summary";
import { startOfMonth, formatUSDFromCents as formatUSD } from "@/lib/money";
import { countTransactions, listAccounts, listTransactions } from "@/lib/services/finance";
import { assertFinanceVisible } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

function formatUSDFromCents(cents: number): string {
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

  if (accounts.length > 0) {
    const snapshot = summarizeBalances(accounts);
    return (
      <WidgetCard name="The Ledger" href="/app/finance" folio="II.">
        <div className="space-y-6">
          <div>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
              Net worth
            </p>
            <p className="mt-2 font-display text-[2.6rem] font-medium leading-none tracking-[-0.035em] tabular text-ink">
              {formatUSDFromCents(snapshot.netWorthCents)}
            </p>
          </div>
          <dl className="rule-soft-t border-rule pt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">Cash</dt>
              <dd className="font-mono tabular text-ink">{formatUSDFromCents(snapshot.cashCents)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">Owed</dt>
              <dd className="font-mono tabular text-oxblood">{formatUSDFromCents(snapshot.cardsOwedCents)}</dd>
            </div>
          </dl>
          {(snapshot.investmentCents > 0 || snapshot.retirementCents > 0) && (
            <p className="font-serif text-sm italic leading-relaxed text-ink-fade">
              <span className="not-italic font-mono tabular text-ink-soft">
                {formatUSDFromCents(snapshot.investmentCents + snapshot.retirementCents)}
              </span>{" "}
              held in long-term positions.
            </p>
          )}
        </div>
      </WidgetCard>
    );
  }

  if (count === 0) {
    return (
      <WidgetCard name="The Ledger" href="/app/finance" folio="II.">
        <div className="space-y-3">
          <p className="font-display text-[1.5rem] leading-tight tracking-[-0.02em] text-ink">
            No entries on record.
          </p>
          <p className="font-serif text-sm italic leading-relaxed text-ink-fade">
            Import a statement, upload a CSV, or post the first account by hand.
          </p>
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
    <WidgetCard name="The Ledger" href="/app/finance" folio="II.">
      <div className="space-y-6">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
            True spend, month to date
          </p>
          <p className="mt-2 font-display text-[2.6rem] font-medium leading-none tracking-[-0.035em] tabular text-oxblood">
            {formatUSDFromCents(spentCents)}
          </p>
        </div>
        <dl className="rule-soft-t border-rule pt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div className="flex items-baseline justify-between">
            <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">Net</dt>
            <dd className={`font-mono tabular ${netCents >= 0 ? "text-verdigris" : "text-oxblood"}`}>
              {formatUSDFromCents(netCents)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">Pace</dt>
            <dd className="font-mono tabular text-ink">{formatUSDFromCents(projection.projectedCents)}</dd>
          </div>
        </dl>
        {topCategory && (
          <p className="font-serif text-sm italic leading-relaxed text-ink-fade">
            Heaviest line item:{" "}
            <span className="not-italic font-medium text-ink">{topCategory.category}</span>
            {cardPayments ? (
              <>
                {" · "}
                <span className="not-italic font-mono tabular text-ink-soft">
                  {formatUSDFromCents(cardPayments.amountCents)}
                </span>{" "}
                cleared on cards
              </>
            ) : null}
            .
          </p>
        )}
      </div>
    </WidgetCard>
  );
}
