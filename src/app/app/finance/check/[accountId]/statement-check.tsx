"use client";

// The statement check, one step at a time:
//   1. Upload the statement (CSV or PDF).
//   2. Review: most lines match what you logged automatically. Decide on
//      near misses (a tip, a typo), and which unlogged lines to add.
//   3. Type the statement's starting and ending balance. If it adds up,
//      everything on it is locked as "matches the bank".

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { checkStatementBalance } from "@/lib/finance-statement-match";
import { parseCurrencyToCents } from "@/lib/finance-accounts";
import {
  commitStatement,
  previewStatement,
  type StatementLineView,
  type StatementPreviewState,
} from "../../actions";

type Preview = Extract<NonNullable<StatementPreviewState>, { ok: true }>;

function money(cents: number) {
  const abs = (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return cents < 0 ? `−${abs}` : abs;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function safeCents(value: string): number | null {
  if (!value.trim()) return null;
  try {
    return parseCurrencyToCents(value);
  } catch {
    return null;
  }
}

export function StatementCheck(props: { accountId: string; accountName: string }) {
  // Remounting resets the upload step's action state for "Start over".
  const [attempt, setAttempt] = useState(0);
  return <StatementCheckFlow key={attempt} {...props} onRestart={() => setAttempt((n) => n + 1)} />;
}

function StatementCheckFlow({
  accountId,
  accountName,
  onRestart,
}: {
  accountId: string;
  accountName: string;
  onRestart: () => void;
}) {
  const [state, action, pending] = useActionState(previewStatement, undefined);

  if (state?.ok) {
    return <Review preview={state} accountName={accountName} onRestart={onRestart} />;
  }

  return (
    <form action={action} className="space-y-4 rounded-md border p-5" style={{ borderColor: "var(--border-soft)" }}>
      <input type="hidden" name="accountId" value={accountId} />
      <Step n={1} title="Upload the statement">
        Download it from your bank&rsquo;s website. A CSV export works best; PDF statements from Chase,
        Discover, Citi, Wells Fargo and Apple Card work too.
      </Step>
      <input
        type="file"
        name="file"
        accept=".csv,text/csv,.pdf,application/pdf"
        required
        className="block w-full text-[0.875rem]"
      />
      <button type="submit" disabled={pending} className="btn-ink">
        {pending ? "Reading…" : "Read statement"}
      </button>
      {state && !state.ok ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--accent-strong)" }} role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold"
        style={{ background: "var(--text)", color: "var(--bg-page)" }}
      >
        {n}
      </span>
      <div>
        <p className="text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </p>
        {children ? (
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {children}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Review({
  preview,
  accountName,
  onRestart,
}: {
  preview: Preview;
  accountName: string;
  onRestart: () => void;
}) {
  const lineByKey = useMemo(() => new Map(preview.lines.map((l) => [l.key, l])), [preview.lines]);
  const entryById = useMemo(() => new Map(preview.entries.map((e) => [e.id, e])), [preview.entries]);
  // Near misses: true = same purchase, use the statement's amount.
  const [nearAccepted, setNearAccepted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(preview.nearMisses.map((n) => [n.lineKey, true])),
  );
  const [addKeys, setAddKeys] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(preview.statementOnly.map((k) => [k, true])),
  );
  const [periodStart, setPeriodStart] = useState(preview.periodStart);
  const [periodEnd, setPeriodEnd] = useState(preview.periodEnd);
  const [opening, setOpening] = useState(preview.suggestedOpening ?? "");
  const [closing, setClosing] = useState("");
  const [allowAdjustment, setAllowAdjustment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { differenceCents: number; matched: number; added: number }>(null);
  const [pending, start] = useTransition();

  const rejectedNear = preview.nearMisses.filter((n) => !nearAccepted[n.lineKey]);
  const matches = [
    ...preview.matched,
    ...preview.nearMisses.filter((n) => nearAccepted[n.lineKey]),
  ];
  const additions: StatementLineView[] = [
    ...preview.statementOnly.filter((k) => addKeys[k]),
    ...rejectedNear.map((n) => n.lineKey),
  ]
    .map((k) => lineByKey.get(k))
    .filter((l): l is StatementLineView => Boolean(l));
  const inPeriod = (iso: string) => {
    const day = iso.slice(0, 10);
    return day >= periodStart && day <= periodEnd;
  };
  const notOnStatement = [
    ...preview.entriesOnly.filter((id) => {
      const e = entryById.get(id);
      return e ? inPeriod(e.date) : false;
    }),
    ...rejectedNear.map((n) => n.entryId),
  ];
  const loggedOnly = preview.entriesOnly.map((id) => entryById.get(id)).filter(Boolean);

  const openingCents = safeCents(opening);
  const closingCents = safeCents(closing);
  const amounts = [
    ...matches.map((m) => lineByKey.get(m.lineKey)?.amount ?? 0),
    ...additions.map((l) => l.amount),
  ];
  const balance =
    openingCents !== null && closingCents !== null
      ? checkStatementBalance({ kind: preview.kind, openingCents, closingCents, entryAmounts: amounts })
      : null;
  const owed = preview.kind === "credit_card" || preview.kind === "loan";

  if (done) {
    return (
      <div className="space-y-3 rounded-md border p-5" style={{ borderColor: "var(--border-soft)" }}>
        <p className="text-[1.25rem] font-semibold" style={{ color: "var(--verdigris)" }}>
          ✓ {accountName} matches the bank
        </p>
        <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          {done.matched} of your entries confirmed, {done.added} added from the statement
          {done.differenceCents !== 0 ? `, and a ${money(Math.abs(done.differenceCents))} adjustment` : ""}.
          Everything through {new Date(`${periodEnd}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })} is
          locked in, and the balance is saved to your net worth history.
        </p>
        <div className="flex gap-2">
          <Link href="/app/finance?tab=accounts" className="btn-ink">
            Back to accounts
          </Link>
          <Link href="/app/finance?tab=spending&filter=to_sort" className="btn-ghost">
            Sort new entries
          </Link>
        </div>
      </div>
    );
  }

  const finish = () => {
    setError(null);
    if (openingCents === null || closingCents === null) {
      setError("Enter the starting and ending balance from the statement.");
      return;
    }
    start(async () => {
      const result = await commitStatement({
        accountId: preview.accountId,
        periodStart,
        periodEnd,
        opening,
        closing,
        matches: matches.map((m) => ({ entryId: m.entryId, line: lineByKey.get(m.lineKey)! })),
        additions,
        notOnStatement,
        allowAdjustment,
      });
      if (!result.ok) setError(result.error);
      else setDone({ differenceCents: result.differenceCents, matched: matches.length, added: additions.length });
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-md border p-5" style={{ borderColor: "var(--border-soft)" }}>
        <Step n={2} title="Review what matched">
          {preview.lines.length} lines on the statement. {preview.matched.length} matched what you logged
          automatically.
        </Step>

        {preview.nearMisses.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[0.8125rem] font-medium" style={{ color: "var(--text)" }}>
              Close, but the amount is different
            </p>
            <ul className="space-y-2">
              {preview.nearMisses.map((n) => {
                const line = lineByKey.get(n.lineKey)!;
                const entry = entryById.get(n.entryId)!;
                return (
                  <li key={n.lineKey} className="rounded-md px-3 py-2" style={{ background: "var(--bg-tint)" }}>
                    <p className="text-[0.8125rem]" style={{ color: "var(--text)" }}>
                      Statement: {line.description} {money(line.amount)} on {shortDate(line.date)}
                    </p>
                    <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                      You logged: {entry.description} {money(entry.amount)} on {shortDate(entry.date)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[0.8125rem]">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={nearAccepted[n.lineKey] === true}
                          onChange={() => setNearAccepted({ ...nearAccepted, [n.lineKey]: true })}
                        />
                        Same purchase, use the statement amount
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={nearAccepted[n.lineKey] === false}
                          onChange={() => setNearAccepted({ ...nearAccepted, [n.lineKey]: false })}
                        />
                        Different purchases
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {preview.statementOnly.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[0.8125rem] font-medium" style={{ color: "var(--text)" }}>
              On the statement but not logged ({preview.statementOnly.length}). Checked ones get added.
            </p>
            <ul className="max-h-[22rem] space-y-1 overflow-y-auto">
              {preview.statementOnly.map((k) => {
                const line = lineByKey.get(k)!;
                return (
                  <li key={k}>
                    <label className="flex items-center gap-2 py-1 text-[0.8125rem]" style={{ color: "var(--text)" }}>
                      <input
                        type="checkbox"
                        checked={addKeys[k] ?? false}
                        onChange={(e) => setAddKeys({ ...addKeys, [k]: e.target.checked })}
                      />
                      <span className="w-14 shrink-0" style={{ color: "var(--text-faint)" }}>
                        {shortDate(line.date)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{line.description}</span>
                      <span className="shrink-0 tabular">{money(line.amount)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {loggedOnly.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[0.8125rem] font-medium" style={{ color: "var(--text)" }}>
              Logged but not on this statement ({loggedOnly.length})
            </p>
            <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              Usually it posts next month, was a different card, or has a typo. They stay as &ldquo;not on a
              statement yet&rdquo; and you can fix or remove them on the Spending tab.
            </p>
            <ul className="space-y-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              {loggedOnly.slice(0, 12).map((e) => (
                <li key={e!.id}>
                  {shortDate(e!.date)} · {e!.description} · {money(e!.amount)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {preview.matched.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              Show the {preview.matched.length} matches
            </summary>
            <ul className="mt-1 space-y-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
              {preview.matched.map((m) => {
                const line = lineByKey.get(m.lineKey)!;
                return (
                  <li key={m.lineKey}>
                    ✓ {shortDate(line.date)} · {line.description} · {money(line.amount)}
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="space-y-4 rounded-md border p-5" style={{ borderColor: "var(--border-soft)" }}>
        <Step n={3} title="Confirm the balance">
          Copy these from the top of the statement.{owed ? " For a card, use what you owed." : ""}
        </Step>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            Period starts
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="field block w-full" />
          </label>
          <label className="space-y-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            Period ends
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="field block w-full" />
          </label>
          <label className="space-y-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {owed ? "Previous balance (owed)" : "Starting balance"}
            <input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" placeholder="0.00" className="field block w-full tabular" />
          </label>
          <label className="space-y-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {owed ? "New balance (owed)" : "Ending balance"}
            <input value={closing} onChange={(e) => setClosing(e.target.value)} inputMode="decimal" placeholder="0.00" className="field block w-full tabular" />
          </label>
        </div>

        {balance ? (
          balance.differenceCents === 0 ? (
            <p className="text-[0.9375rem] font-semibold" style={{ color: "var(--verdigris)" }}>
              ✓ It adds up.
            </p>
          ) : (
            <div className="space-y-2 rounded-md px-3 py-2" style={{ background: "var(--accent-tint)" }}>
              <p className="text-[0.875rem]" style={{ color: "var(--text)" }}>
                Off by {money(Math.abs(balance.differenceCents))}. The lines add up to{" "}
                {money(balance.expectedClosingCents)}, the statement says {money(closingCents ?? 0)}.
              </p>
              <p className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
                Usually it&rsquo;s a typo in a balance, or a line left unchecked above. If you can&rsquo;t find it,
                an adjustment makes it match and is labelled so you can spot it later.
              </p>
              <label className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--text)" }}>
                <input type="checkbox" checked={allowAdjustment} onChange={(e) => setAllowAdjustment(e.target.checked)} />
                Add a {money(Math.abs(balance.differenceCents))} adjustment
              </label>
            </div>
          )
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ink"
            disabled={pending || !balance || (balance.differenceCents !== 0 && !allowAdjustment)}
            onClick={finish}
          >
            {pending ? "Saving…" : "Finish check"}
          </button>
          <button type="button" className="btn-ghost" onClick={onRestart} disabled={pending}>
            Start over
          </button>
        </div>
        {error ? (
          <p className="text-[0.8125rem]" style={{ color: "var(--accent-strong)" }} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
