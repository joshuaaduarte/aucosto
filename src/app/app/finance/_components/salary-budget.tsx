"use client";

// Living on one paycheck: the paychecks you live on vs. invest, the budget
// that fits inside the live-on pay (50/30/20 check), and set-aside pots.
// Logic lives in src/lib/finance-paychecks.ts.

import { useState, useTransition } from "react";
import { formatUSDFromCents } from "@/lib/money";
import type { SalaryBudget } from "@/lib/finance-paychecks";
import { applySuggestedBudget, createFinancePot, saveFinancePaychecks, setAsideMoney } from "../actions";
import { SectionCard } from "./ui";

function fmt(cents: number) {
  return formatUSDFromCents(cents, { maximumFractionDigits: 0 });
}

function pct(share: number) {
  return `${Math.round(share * 100)}%`;
}

function Err({ text }: { text: string | null }) {
  return text ? (
    <p className="text-[0.75rem]" style={{ color: "var(--accent-strong)" }} role="alert">
      {text}
    </p>
  ) : null;
}

// ── Paychecks ────────────────────────────────────────────────────────────

export type PaycheckRow = { name: string; role: "live" | "invest"; perCheck: string };

export function PaychecksForm({ initial, detected }: { initial: PaycheckRow[]; detected: number[] }) {
  const [rows, setRows] = useState<PaycheckRow[]>(
    initial.length ? initial : [
      { name: "", role: "live", perCheck: detected[0] ? (detected[0] / 100).toFixed(2) : "" },
      { name: "", role: "invest", perCheck: detected[1] ? (detected[1] / 100).toFixed(2) : "" },
    ],
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<PaycheckRow>) => {
    setSaved(false);
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await saveFinancePaychecks(rows.filter((x) => x.name.trim() || x.perCheck.trim()));
          if (!r.ok) setError(r.error);
          else setSaved(true);
        });
      }}
    >
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
          <label>
            Whose
            <input value={row.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Name" className="field mt-1 block w-[8rem]" />
          </label>
          <label>
            Take-home per check
            <input
              value={row.perCheck}
              onChange={(e) => set(i, { perCheck: e.target.value })}
              inputMode="decimal"
              placeholder="0.00"
              className="field mt-1 block w-[8.5rem] tabular"
            />
          </label>
          <label>
            This pay is for
            <select value={row.role} onChange={(e) => set(i, { role: e.target.value as "live" | "invest" })} className="field mt-1 block">
              <option value="live">Living on</option>
              <option value="invest">Investing</option>
            </select>
          </label>
          <button type="button" className="btn-ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            Remove
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className="btn-ink">
          {pending ? "Saving…" : "Save paychecks"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setRows([...rows, { name: "", role: "invest", perCheck: "" }])}>
          Add a paycheck
        </button>
        {saved ? (
          <span className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
            Saved.
          </span>
        ) : null}
      </div>
      <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        Every other week, after taxes and anything taken out before it lands. Paychecks in checking are recognized by amount.
        {detected.length ? ` Seen in your history: ${detected.map((c) => formatUSDFromCents(c)).join(", ")}.` : ""}
      </p>
      <Err text={error} />
    </form>
  );
}

// ── Budget on the live-on pay ────────────────────────────────────────────

function Bar({ parts }: { parts: Array<{ share: number; color: string; label: string }> }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-tint-strong)" }}>
      {parts.map((p) => (
        <div key={p.label} title={p.label} style={{ width: `${Math.min(100, Math.max(0, p.share * 100))}%`, background: p.color }} />
      ))}
    </div>
  );
}

export function SalaryBudgetCard({
  budget,
  liveName,
  investName,
  flexibleCents,
  hasLimits,
}: {
  budget: SalaryBudget;
  liveName: string;
  investName: string | null;
  flexibleCents: number;
  hasLimits: boolean;
}) {
  const [pending, start] = useTransition();
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimits, setShowLimits] = useState(false);
  const m = budget.thisMonth;
  const over = budget.leftoverCents < 0;
  return (
    <SectionCard
      title={`Living on ${liveName}'s pay`}
      subtitle={`${fmt(budget.ceilingCents)} a month take-home. A typical month, your bills and set-asides, against it.`}
    >
      <Bar
        parts={[
          { share: budget.needsShare, color: "var(--text)", label: "Needs" },
          { share: budget.wantsShare, color: "var(--text-muted)", label: "Wants" },
          { share: budget.potsCents / (budget.ceilingCents || 1), color: "var(--accent)", label: "Set aside" },
        ]}
      />
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[0.8125rem] sm:grid-cols-4">
        <div>
          <dt style={{ color: "var(--text-faint)" }}>Needs (aim ≤ 50%)</dt>
          <dd className="tabular" style={{ color: budget.needsShare > 0.5 ? "var(--accent-strong)" : "var(--text)" }}>
            {fmt(budget.needsCents)} · {pct(budget.needsShare)}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--text-faint)" }}>Wants (aim ≤ 30%)</dt>
          <dd className="tabular" style={{ color: budget.wantsShare > 0.3 ? "var(--accent-strong)" : "var(--text)" }}>
            {fmt(budget.wantsCents)} · {pct(budget.wantsShare)}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--text-faint)" }}>Set aside</dt>
          <dd className="tabular" style={{ color: "var(--text)" }}>
            {fmt(budget.potsCents)}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--text-faint)" }}>{over ? "Over the pay" : "Left over (aim ≥ 20% with set-asides)"}</dt>
          <dd className="tabular font-semibold" style={{ color: over ? "var(--accent-strong)" : "var(--text)" }}>
            {over ? `${fmt(-budget.leftoverCents)} a month` : `${fmt(budget.leftoverCents)} · ${pct(budget.saveShare)}`}
          </dd>
        </div>
      </dl>

      <div className="mt-4 space-y-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        <p>
          This month: {fmt(m.spentCents)} spent so far, heading for about {fmt(m.expectedCents)} with set-asides.{" "}
          {m.dipCents > 0 ? (
            <span className="font-semibold" style={{ color: "var(--accent-strong)" }}>
              On pace to dip into {investName ?? "the other"} pay by {fmt(m.dipCents)}.
            </span>
          ) : (
            <span>Inside {liveName}&rsquo;s pay.</span>
          )}
        </p>
        <p>
          {liveName}&rsquo;s pay this month: {m.live.count} {m.live.count === 1 ? "check" : "checks"}, {fmt(m.live.cents)}.
          {m.bonusCents > 0 ? ` A third paycheck this month: ${fmt(m.bonusCents)} extra to save.` : ""}
        </p>
        {investName ? (
          <p>
            {investName}&rsquo;s pay this month: {m.invest.count} {m.invest.count === 1 ? "check" : "checks"}, {fmt(m.invest.cents)}
            {m.invest.cents > 0 ? " for investing." : "."}
          </p>
        ) : null}
      </div>

      {budget.suggestedLimits.length ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={hasLimits ? "btn-ghost" : "btn-ink"}
              disabled={pending || applied}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await applySuggestedBudget({
                    limits: budget.suggestedLimits.filter((l) => l.cents > 0).map((l) => ({ category: l.category, cents: l.cents })),
                    flexibleCents,
                  });
                  if (!r.ok) setError(r.error);
                  else setApplied(true);
                })
              }
            >
              {applied ? "Limits saved" : pending ? "Saving…" : hasLimits ? "Update limits to this" : "Use these limits"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowLimits(!showLimits)} aria-expanded={showLimits}>
              {showLimits ? "Hide" : "See"} the {budget.suggestedLimits.length} category limits
            </button>
          </div>
          {showLimits ? (
            <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-[0.8125rem] sm:grid-cols-2">
              {budget.suggestedLimits.map((l) => (
                <li key={l.category} className="flex justify-between gap-3" style={{ color: "var(--text-muted)" }}>
                  <span>{l.category}</span>
                  <span className="tabular" style={{ color: l.trimmed ? "var(--accent-strong)" : "var(--text)" }}>
                    {fmt(l.cents)}
                    {l.trimmed ? " (trimmed to fit)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            Limits come from your last 3 months. If they don&rsquo;t fit the pay, wants are trimmed first. Your weekly allowance follows them.
          </p>
          <Err text={error} />
        </div>
      ) : null}
    </SectionCard>
  );
}

// ── Set-aside pots ───────────────────────────────────────────────────────

export type PotView = {
  id: string;
  name: string;
  savedCents: number;
  targetCents: number;
  monthlyCents: number;
  targetDateLabel: string | null;
  emergency: boolean;
};

export function PotsCard({
  pots,
  emergencyTargetCents,
  heldIn,
}: {
  pots: PotView[];
  /** 6 × a typical month; offered when there's no emergency fund yet. */
  emergencyTargetCents: number | null;
  heldIn: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const total = pots.reduce((a, p) => a + p.savedCents, 0);
  const hasEmergency = pots.some((p) => p.emergency);
  return (
    <SectionCard
      title="Set aside"
      subtitle={`Money with a job: travel, gifts, the emergency fund. ${fmt(total)} set aside${heldIn ? `, held in ${heldIn}` : ""}.`}
    >
      {pots.length ? (
        <ul>
          {pots.map((p) => (
            <PotRow key={p.id} pot={p} />
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {!hasEmergency && emergencyTargetCents ? <EmergencyButton targetCents={emergencyTargetCents} /> : null}
        <button type="button" className="btn-ghost" onClick={() => setAdding(!adding)} aria-expanded={adding}>
          {adding ? "Close" : "New pot"}
        </button>
      </div>
      {adding ? <NewPotForm onDone={() => setAdding(false)} /> : null}
    </SectionCard>
  );
}

function EmergencyButton({ targetCents }: { targetCents: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn-ink"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createFinancePot({
              name: "Emergency fund",
              target: (targetCents / 100).toFixed(2),
              monthly: "",
              targetDate: "",
              emergency: true,
            });
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pending ? "Starting…" : `Start an emergency fund: ${fmt(targetCents)} (6 months)`}
      </button>
      <Err text={error} />
    </>
  );
}

function PotRow({ pot }: { pot: PotView }) {
  const [amount, setAmount] = useState(pot.monthlyCents ? (pot.monthlyCents / 100).toFixed(0) : "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const share = pot.targetCents > 0 ? Math.min(1, pot.savedCents / pot.targetCents) : 0;
  return (
    <li className="border-b py-2.5" style={{ borderColor: "var(--border-faint)" }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-[10rem] flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[0.875rem]" style={{ color: "var(--text)" }}>
              {pot.name}
            </p>
            <p className="text-[0.8125rem] tabular" style={{ color: "var(--text)" }}>
              {fmt(pot.savedCents)}
              {pot.targetCents > 0 ? <span style={{ color: "var(--text-faint)" }}> of {fmt(pot.targetCents)}</span> : null}
            </p>
          </div>
          {pot.targetCents > 0 ? (
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-tint-strong)" }}>
              <div style={{ width: `${share * 100}%`, height: "100%", background: "var(--accent)" }} />
            </div>
          ) : null}
          <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            {pot.monthlyCents ? `${fmt(pot.monthlyCents)} a month` : "No monthly amount"}
            {pot.targetDateLabel ? ` · by ${pot.targetDateLabel}` : ""}
          </p>
        </div>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await setAsideMoney({ potId: pot.id, amount });
              if (!r.ok) setError(r.error);
            });
          }}
        >
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            aria-label={`Amount to set aside for ${pot.name}`}
            placeholder="0"
            className="field w-[6rem] tabular"
          />
          <button type="submit" disabled={pending} className="btn-ghost">
            {pending ? "Saving…" : "Set aside"}
          </button>
        </form>
      </div>
      <Err text={error} />
    </li>
  );
}

function NewPotForm({ onDone }: { onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2 text-[0.75rem]"
      style={{ color: "var(--text-muted)" }}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await createFinancePot({
            name: String(f.get("name") ?? ""),
            target: String(f.get("target") ?? ""),
            monthly: String(f.get("monthly") ?? ""),
            targetDate: String(f.get("date") ?? ""),
          });
          if (!r.ok) setError(r.error);
          else onDone();
        });
      }}
    >
      <label>
        Name
        <input name="name" required placeholder="Travel" className="field mt-1 block w-[9rem]" />
      </label>
      <label>
        Target
        <input name="target" required inputMode="decimal" placeholder="3000" className="field mt-1 block w-[7rem] tabular" />
      </label>
      <label>
        Needed by (optional)
        <input name="date" type="date" className="field mt-1 block" />
      </label>
      <label>
        Monthly (optional)
        <input name="monthly" inputMode="decimal" placeholder="auto" className="field mt-1 block w-[6.5rem] tabular" />
      </label>
      <button type="submit" disabled={pending} className="btn-ink">
        {pending ? "Saving…" : "Add pot"}
      </button>
      <span className="w-full" style={{ color: "var(--text-faint)" }}>
        With a date, the monthly amount is worked out for you: what&rsquo;s left ÷ months to go.
      </span>
      <Err text={error} />
    </form>
  );
}
