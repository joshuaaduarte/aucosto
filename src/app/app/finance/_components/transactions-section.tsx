import type { FinanceDashboard } from "../_lib/derive";
import { TransactionsReview } from "../transactions-review";

export function TransactionsSection({ data }: { data: FinanceDashboard }) {
  const { history, count } = data;

  return (
    <section id="transactions" className="space-y-6">
      <header className="rule-t border-ink pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.26em] text-ink-fade">
              {count > 0
                ? `Reviewing ${Math.min(history.length, count)} of ${count}`
                : "Daily Accounts"}
            </p>
            <h2 className="mt-2 font-display text-3xl font-medium italic tracking-[-0.02em] text-ink">
              Every entry, in the order it was posted.
            </h2>
          </div>
          {count > 0 ? (
            <a
              href="#manage"
              className="font-serif text-sm italic text-ink-fade underline-offset-4 decoration-rule hover:text-ink hover:underline"
            >
              Edit accounts or goals →
            </a>
          ) : null}
        </div>
      </header>

      {history.length === 0 ? (
        <p className="rule-t rule-b border-rule px-2 py-10 text-center font-serif italic text-ink-fade">
          ❦ No entries yet. Import a CSV or statement above. ❦
        </p>
      ) : (
        <TransactionsReview
          transactions={history.map((transaction) => ({
            id: transaction.id,
            date: transaction.date.toISOString(),
            amount: transaction.amount,
            description: transaction.description,
            account: transaction.account,
            category: transaction.category,
          }))}
        />
      )}
    </section>
  );
}
