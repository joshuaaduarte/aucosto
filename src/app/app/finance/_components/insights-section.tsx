import { formatTransactionType } from "@/lib/finance-types";
import { formatUSDFromCents } from "@/lib/money";
import type { FinanceDashboard } from "../_lib/derive";
import { SectionCard, typeTone } from "./ui";

export function InsightsSection({ data }: { data: FinanceDashboard }) {
  const { typeSummary, snapshot, topCategories, topMerchants, recurringCandidates, count } = data;

  return (
    <section id="insights" className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        {count > 0 && (
          <SectionCard
            title="Money movement mix"
            subtitle="Separate true spend from transfers, payoffs, and inflows."
          >
            {typeSummary.length > 0 ? (
              <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {typeSummary.map((item) => (
                  <li
                    key={item.type}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 px-4 py-4 dark:border-zinc-800"
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${typeTone(item.type)}`}
                      >
                        {formatTransactionType(item.type)}
                      </span>
                      <p className="mt-2 text-xs text-zinc-500">
                        {item.count} transaction{item.count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatUSDFromCents(item.amountCents)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-zinc-500">
                Import transactions to see your money movement split.
              </p>
            )}
          </SectionCard>
        )}

        <SectionCard title="Cash position" subtitle="A tighter read on what is available versus owed.">
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Available</p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {formatUSDFromCents(snapshot.cashCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Cards owed</p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {formatUSDFromCents(snapshot.cardsOwedCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Loans owed</p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {formatUSDFromCents(snapshot.loansOwedCents)}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Top categories" subtitle="Where true spend is concentrating this month.">
          {topCategories.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No spending yet this month.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {topCategories.map((category) => (
                <li
                  key={category.category}
                  className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-3 text-sm dark:bg-zinc-800/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {category.category}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {category.count} transaction{category.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatUSDFromCents(category.spendCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Top merchants" subtitle="The biggest names in this month’s true spend.">
          {topMerchants.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No spending yet this month.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {topMerchants.map((merchant) => (
                <li
                  key={merchant.merchant}
                  className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-3 text-sm dark:bg-zinc-800/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {merchant.merchant}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {merchant.count} transaction{merchant.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatUSDFromCents(merchant.spendCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recurring" subtitle="Charges that look like they may repeat automatically.">
          {recurringCandidates.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No strong recurring patterns yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recurringCandidates.map((item) => (
                <li
                  key={`${item.merchant}-${item.amountCents}-${item.account ?? ""}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-3 text-sm dark:bg-zinc-800/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {item.merchant}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {item.count} charges
                      {item.account ? ` · ${item.account}` : ""}
                      {` · last ${item.lastDate.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}`}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
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
