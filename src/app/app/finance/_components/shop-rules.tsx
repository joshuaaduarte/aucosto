"use client";

// Remembered shops: what each one is called and filed under. Rules come
// from sorting ("Always use this for …") and from bank files confirming what
// you logged. Each person's rules are their own; Remove forgets one.

import { useState, useTransition } from "react";
import { removeShopRule } from "../actions";

export type ShopRuleView = {
  id: string;
  /** The shop's key, e.g. "trader joes". */
  match: string;
  name: string | null;
  category: string | null;
  /** First name of whoever made it, in a shared space. */
  ownerName: string | null;
};

export function ShopRules({ rules }: { rules: ShopRuleView[] }) {
  const [gone, setGone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = rules.filter((r) => !gone.includes(r.id));
  if (shown.length === 0) {
    return (
      <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
        None yet. Sort a purchase with &ldquo;Always use this&rdquo; on, or import a bank file that matches
        what you logged, and the shop is remembered here.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <ul className="divide-y" style={{ borderColor: "var(--border-faint)" }}>
        {shown.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5" style={{ borderColor: "var(--border-faint)" }}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem]" style={{ color: "var(--text)" }}>
                {r.name ?? titleCase(r.match)}
                {r.category ? (
                  <span style={{ color: "var(--text-muted)" }}> → {r.category}</span>
                ) : null}
              </p>
              <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                Matches &ldquo;{r.match}&rdquo;{r.ownerName ? ` · ${r.ownerName}'s` : ""}
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await removeShopRule(r.id);
                  if (res && !res.ok) setError(res.error);
                  else setGone((g) => [...g, r.id]);
                })
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--attention)" }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
