// "Where our money is": ready cash as one bar, split into what's spoken
// for (cards, bills, the rest of this month's spending, pots) and what's
// truly free; then each cash account with the pots it holds and how fresh
// its balance is; long-term money sits apart and is never counted as ready.
// Server component; the breakdowns open with <details>, no client JS.

import Link from "next/link";
import { formatUSDFromCents } from "@/lib/money";
import type { Freshness, MoneyMap, SpokenForPart } from "@/lib/finance-money-map";

const PART_COLOR: Record<SpokenForPart["key"], string> = {
  cards: "var(--accent)",
  bills: "var(--attention)",
  budget: "color-mix(in srgb, var(--attention) 45%, transparent)",
  pots: "var(--text-muted)",
};
const FREE_COLOR = "var(--positive)";

const FRESH_LABEL: Record<Freshness, string> = { fresh: "up to date", aging: "getting old", stale: "needs an update" };
const FRESH_COLOR: Record<Freshness, string> = {
  fresh: "var(--positive)",
  aging: "var(--text-faint)",
  stale: "var(--attention)",
};

function fmt(cents: number) {
  return formatUSDFromCents(cents, { maximumFractionDigits: 0 });
}

function ageLabel(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function WhereMoneyIs({ map }: { map: MoneyMap }) {
  if (map.cash.length === 0) {
    return (
      <section className="rounded-md border p-5" style={{ borderColor: "var(--border-soft)" }}>
        <Eyebrow>Where our money is</Eyebrow>
        <p className="mt-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
          Add your checking and savings accounts to see what&rsquo;s ready, what&rsquo;s spoken for and
          what&rsquo;s truly free.{" "}
          <Link href="/app/finance?tab=accounts" className="underline" style={{ color: "var(--text)" }}>
            Add accounts →
          </Link>
        </p>
      </section>
    );
  }

  const short = map.freeCents < 0;
  const total = Math.max(map.readyCents, map.spokenForCents, 1);
  const segments = [
    ...map.spokenFor.map((p) => ({ key: p.key, label: p.label, cents: p.cents, color: PART_COLOR[p.key] })),
    ...(short ? [] : [{ key: "free", label: "Truly free", cents: map.freeCents, color: FREE_COLOR }]),
  ].filter((s) => s.cents > 0);

  return (
    <section
      className="rounded-md border p-5"
      style={{ borderColor: "var(--border-soft)" }}
      aria-labelledby="where-money-is-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Eyebrow id="where-money-is-title">Where our money is</Eyebrow>
        <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          bills over the next {map.windowDays} days
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Figure label="Ready cash" cents={map.readyCents} />
        <Figure label="Spoken for" cents={map.spokenForCents} />
        <Figure
          label={short ? "Short by" : "Truly free"}
          cents={Math.abs(map.freeCents)}
          color={short ? "var(--attention)" : FREE_COLOR}
          strong
        />
      </div>

      <div
        className="mt-4 flex h-3 w-full overflow-hidden rounded-full"
        style={{ background: "var(--bg-tint-strong)" }}
        role="img"
        aria-label={`${fmt(map.readyCents)} ready: ${segments.map((s) => `${s.label} ${fmt(s.cents)}`).join(", ")}`}
      >
        {segments.map((s) => (
          <span
            key={s.key}
            className="h-full"
            style={{ width: `${(s.cents / total) * 100}%`, background: s.color, minWidth: 3 }}
          />
        ))}
      </div>
      {short ? (
        <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--attention)" }}>
          What&rsquo;s spoken for is {fmt(-map.freeCents)} more than the cash on hand. Move money in, or
          push something to after payday.
        </p>
      ) : null}

      <ul className="mt-4 divide-y" style={{ borderColor: "var(--border-faint)" }}>
        {map.spokenFor.map((p) => (
          <li key={p.key} style={{ borderColor: "var(--border-faint)" }}>
            <details className="group py-2">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 text-[0.875rem] [&::-webkit-details-marker]:hidden">
                <Dot color={PART_COLOR[p.key]} />
                <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text)" }}>
                  {p.label}
                </span>
                <span className="tabular" style={{ color: "var(--text)" }}>
                  {fmt(p.cents)}
                </span>
                <span aria-hidden className="text-[0.75rem] transition-transform group-open:rotate-90" style={{ color: "var(--text-faint)" }}>
                  ›
                </span>
              </summary>
              <ul className="mt-1.5 space-y-1 pl-5">
                {p.items.map((i) => (
                  <li key={i.name} className="flex items-baseline gap-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                    <span className="min-w-0 flex-1 truncate">
                      {i.name}
                      {i.note ? <span style={{ color: "var(--text-faint)" }}> · {i.note}</span> : null}
                    </span>
                    <span className="tabular">{fmt(i.cents)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
        {!short ? (
          <li className="flex items-center gap-2.5 py-2 text-[0.875rem]" style={{ borderColor: "var(--border-faint)" }}>
            <Dot color={FREE_COLOR} />
            <span className="flex-1 font-medium" style={{ color: "var(--text)" }}>
              Truly free
            </span>
            <span className="tabular font-semibold" style={{ color: "var(--text)" }}>
              {fmt(map.freeCents)}
            </span>
            <span aria-hidden className="w-[0.5rem]" />
          </li>
        ) : null}
      </ul>

      <h3 className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        Where it sits
      </h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {map.cash.map((a) => (
          <li key={a.id} className="rounded-md px-3 py-2.5" style={{ background: "var(--bg-tint)" }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                {a.name}
              </span>
              <span className="tabular text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
                {a.estimated ? "≈ " : ""}
                {fmt(a.cents)}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              <Dot color={FRESH_COLOR[a.freshness]} small />
              <span>
                Balance from {ageLabel(a.daysOld)}
                {a.freshness === "fresh" ? "" : ` · ${FRESH_LABEL[a.freshness]}`}
                {a.estimated ? " + entries since" : ""}
              </span>
            </p>
            {a.pots.length ? (
              <PotsBar pots={a.pots} accountCents={a.cents} />
            ) : null}
          </li>
        ))}
      </ul>

      {map.longTerm.length ? (
        <div className="mt-5 rounded-md border px-3 py-2.5" style={{ borderColor: "var(--border-soft)" }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Long-term · not counted as ready
            </span>
            <span className="tabular text-[0.9375rem] font-semibold" style={{ color: "var(--text)" }}>
              {fmt(map.longTermCents)}
            </span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {map.longTerm.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                <Dot color={FRESH_COLOR[a.freshness]} small />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {ageLabel(a.daysOld)}
                </span>
                <span className="tabular">{fmt(a.cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {map.oldestCashDays !== null && map.oldestCashDays > 7 ? (
        <p className="mt-3 text-[0.8125rem]">
          <Link href="/app/finance/catch-up" className="underline" style={{ color: "var(--text-muted)" }}>
            Update balances so these numbers stay right →
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function PotsBar({ pots, accountCents }: { pots: Array<{ name: string; cents: number }>; accountCents: number }) {
  const potsCents = pots.reduce((s, p) => s + p.cents, 0);
  const rest = accountCents - potsCents;
  return (
    <div className="mt-2">
      <ul className="space-y-0.5">
        {pots.map((p) => (
          <li key={p.name} className="flex items-baseline gap-2 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
            <Dot color={PART_COLOR.pots} small />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="tabular">{fmt(p.cents)}</span>
          </li>
        ))}
        <li className="flex items-baseline gap-2 text-[0.75rem]" style={{ color: rest < 0 ? "var(--attention)" : "var(--text-faint)" }}>
          <span className="inline-block w-1.5" />
          <span className="flex-1">{rest < 0 ? "Pots are more than the balance" : "Not in a pot"}</span>
          <span className="tabular">{fmt(Math.abs(rest))}</span>
        </li>
      </ul>
    </div>
  );
}

function Figure({ label, cents, color, strong }: { label: string; cents: number; color?: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p
        className={`tabular truncate font-semibold tracking-tight ${strong ? "text-[1.375rem] sm:text-[1.75rem]" : "text-[1.125rem] sm:text-[1.375rem]"}`}
        style={{ color: color ?? "var(--text)", letterSpacing: "-0.02em" }}
      >
        {fmt(cents)}
      </p>
    </div>
  );
}

function Eyebrow({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
      {children}
    </h2>
  );
}

function Dot({ color, small }: { color: string; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${small ? "h-1.5 w-1.5" : "h-2.5 w-2.5"}`}
      style={{ background: color }}
    />
  );
}
