import type { FinanceDashboard } from "../_lib/derive";
import { TransactionsReview } from "../transactions-review";

export function TransactionsSection({ data }: { data: FinanceDashboard }) {
  const { history, count } = data;

  return (
    <section id="transactions" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            {count > 0 ? `Review ${Math.min(history.length, count)} of ${count}` : "Transactions"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Clean filters, faster scanning, and the latest linked activity first.
          </p>
        </div>
        {count > 0 ? (
          <a
            href="#manage"
            className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
          >
            Need to edit accounts or goals?
          </a>
        ) : null}
      </div>
      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-500">
          No transactions yet. Import a CSV or statement PDF above.
        </div>
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
