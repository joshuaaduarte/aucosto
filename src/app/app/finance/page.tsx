import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UploadForm } from "./upload-form";
import { ClearButton } from "./clear-button";

export const dynamic = "force-dynamic";

function formatUSD(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function FinancePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [count, recent] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Finance</h1>
          <p className="mt-2 text-zinc-500">
            Drop in a CSV from your bank. We expect a header row with Date,
            Amount (or Debit/Credit), and Description.
          </p>
        </div>
        {count > 0 && <ClearButton />}
      </div>

      <UploadForm />

      <div>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          {count > 0 ? `Recent ${recent.length} of ${count}` : "Transactions"}
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No transactions yet. Import a CSV above.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {recent.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t.description}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t.date.toLocaleDateString([], {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {t.account ? ` · ${t.account}` : ""}
                  </p>
                </div>
                <span
                  className={`font-mono text-sm tabular-nums ${
                    t.amount < 0
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatUSD(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
