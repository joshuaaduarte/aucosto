// Statement check for one account: upload the statement, review what
// matched your logged entries, confirm the ending balance, done.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireViewerContext } from "@/lib/viewer-context";
import { listAccounts, listStatementChecks } from "@/lib/services/finance";
import { formatAccountKind } from "@/lib/finance-accounts";
import { StatementCheck } from "./statement-check";

export const dynamic = "force-dynamic";

export default async function StatementCheckPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const context = await requireViewerContext();
  if (!context.financeVisible) redirect("/app");
  const { accountId } = await params;
  const [accounts, checks] = await Promise.all([
    listAccounts(context.financeUserId),
    listStatementChecks(context.financeUserId),
  ]);
  const account = accounts.find((a) => a.id === accountId);
  if (!account) notFound();
  const last = checks.checks.find((c) => c.financeAccountId === accountId) ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div>
        <Link href="/app/finance?tab=accounts" className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          ← Accounts
        </Link>
        <h1 className="mt-2 text-[1.5rem] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Check a statement
        </h1>
        <p className="mt-1 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          {account.name} · {formatAccountKind(account.kind)}
          {last
            ? ` · last checked through ${last.periodEnd.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
            : ""}
        </p>
      </div>
      {checks.ready ? (
        <StatementCheck accountId={account.id} accountName={account.name} />
      ) : (
        <p className="rounded-md px-4 py-3 text-[0.875rem]" style={{ background: "var(--accent-tint)", color: "var(--text-muted)" }}>
          Statement checks need a one-time database update first (scripts/create-finance-tracking.sql).
          In the meantime you can use &ldquo;Update balance&rdquo; on the Accounts tab.
        </p>
      )}
    </div>
  );
}
