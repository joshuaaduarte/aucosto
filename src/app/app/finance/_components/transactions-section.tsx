import type { FinanceDashboard } from "../_lib/derive";
import { TransactionsReview } from "../transactions-review";

export function TransactionsSection({ data }: { data: FinanceDashboard }) {
  const { history, count } = data;

  return (
    <section id="transactions" className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            {count > 0
              ? `Reviewing ${Math.min(history.length, count)} of ${count}`
              : "Transactions"}
          </p>
          <h2
            className="mt-1 text-[1.25rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Every entry, in the order it posted.
          </h2>
        </div>
        {count > 0 && (
          <a
            href="#manage"
            className="text-[0.8125rem] font-medium transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Edit accounts or goals →
          </a>
        )}
      </header>

      {history.length === 0 ? (
        <p
          className="rounded-md py-10 text-center text-[0.875rem]"
          style={{
            color: "var(--text-muted)",
            border: "1px dashed var(--border)",
          }}
        >
          No entries yet. Import a CSV or statement above.
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
