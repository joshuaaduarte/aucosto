import { formatTransactionType } from "@/lib/finance-types";
import { formatUSDFromCents } from "@/lib/money";
import type { FinanceDashboard } from "../_lib/derive";
import { SectionCard, typeTone } from "./ui";

export function InsightsSection({ data }: { data: FinanceDashboard }) {
  const {
    typeSummary,
    snapshot,
    topCategories,
    topMerchants,
    recurringCandidates,
    count,
  } = data;

  return (
    <section id="insights" className="space-y-12">
      <header className="rule-t border-ink pt-4">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.26em] text-ink-fade">
          Section IV · Patterns of Coin
        </p>
        <h2 className="mt-2 font-display text-3xl font-medium italic tracking-[-0.02em] text-ink">
          What the entries, taken together, suggest.
        </h2>
      </header>

      <div className="grid gap-12 xl:grid-cols-[1.15fr_0.85fr] xl:gap-14">
        {count > 0 && (
          <SectionCard
            title="The Movement Mix"
            subtitle="True spend, separated from transfers, payoffs, and inflows."
          >
            {typeSummary.length > 0 ? (
              <ul className="mt-3 divide-y divide-rule-soft">
                {typeSummary.map((item) => (
                  <li
                    key={item.type}
                    className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-4"
                  >
                    <div className="min-w-0">
                      <span
                        className={`inline-flex border px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] ${typeTone(item.type)}`}
                      >
                        {formatTransactionType(item.type)}
                      </span>
                      <p className="mt-1.5 font-serif text-xs italic text-ink-fade">
                        {item.count} entr{item.count === 1 ? "y" : "ies"}
                      </p>
                    </div>
                    <p className="font-mono tabular text-ink">
                      {formatUSDFromCents(item.amountCents)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 font-serif italic text-ink-fade">
                Import entries to read the movement split.
              </p>
            )}
          </SectionCard>
        )}

        <SectionCard
          title="Cash Position"
          subtitle="What is at hand against what is owed."
        >
          <div className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-3">
            <div className="rule-l border-rule pl-4 py-2">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">
                Available
              </p>
              <p className="mt-1.5 font-display text-xl font-medium tabular tracking-[-0.02em] text-verdigris">
                {formatUSDFromCents(snapshot.cashCents)}
              </p>
            </div>
            <div className="rule-l border-rule pl-4 py-2">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">
                Cards owed
              </p>
              <p className="mt-1.5 font-display text-xl font-medium tabular tracking-[-0.02em] text-oxblood">
                {formatUSDFromCents(snapshot.cardsOwedCents)}
              </p>
            </div>
            <div className="rule-l border-rule pl-4 py-2">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-ink-fade">
                Loans owed
              </p>
              <p className="mt-1.5 font-display text-xl font-medium tabular tracking-[-0.02em] text-oxblood">
                {formatUSDFromCents(snapshot.loansOwedCents)}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-3 xl:gap-14">
        <SectionCard
          title="Top Categories"
          subtitle="Where true spend is concentrating this month."
        >
          {topCategories.length === 0 ? (
            <p className="mt-4 font-serif italic text-ink-fade">
              No spending recorded this month.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-rule-soft">
              {topCategories.map((category, i) => (
                <li
                  key={category.category}
                  className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 py-3.5"
                >
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] tabular text-ink-ghost">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-base text-ink">
                      {category.category}
                    </p>
                    <p className="font-serif text-xs italic text-ink-fade">
                      {category.count} entr{category.count === 1 ? "y" : "ies"}
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular text-ink-soft">
                    {formatUSDFromCents(category.spendCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Top Merchants"
          subtitle="The biggest names in this month's accounts."
        >
          {topMerchants.length === 0 ? (
            <p className="mt-4 font-serif italic text-ink-fade">
              No spending recorded this month.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-rule-soft">
              {topMerchants.map((merchant, i) => (
                <li
                  key={merchant.merchant}
                  className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 py-3.5"
                >
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] tabular text-ink-ghost">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-base text-ink">
                      {merchant.merchant}
                    </p>
                    <p className="font-serif text-xs italic text-ink-fade">
                      {merchant.count} entr{merchant.count === 1 ? "y" : "ies"}
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular text-ink-soft">
                    {formatUSDFromCents(merchant.spendCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recurring"
          subtitle="Charges that appear, again, on the regular."
        >
          {recurringCandidates.length === 0 ? (
            <p className="mt-4 font-serif italic text-ink-fade">
              No strong patterns yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-rule-soft">
              {recurringCandidates.map((item) => (
                <li
                  key={`${item.merchant}-${item.amountCents}-${item.account ?? ""}`}
                  className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-base text-ink">
                      {item.merchant}
                    </p>
                    <p className="mt-0.5 font-serif text-xs italic text-ink-fade">
                      {item.count} charges
                      {item.account ? ` · ${item.account}` : ""}
                      {` · last ${item.lastDate.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}`}
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular text-ink-soft">
                    {formatUSDFromCents(item.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </section>
  );
}
