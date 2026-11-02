"use client";

import { useTransition } from "react";
import { switchFinanceScope } from "../actions";

/** Household ⇄ Just me. Only rendered when the viewer belongs to a household. */
export function FinanceScopeSwitcher({
  scope,
  householdName,
}: {
  scope: "household" | "personal";
  householdName: string;
}) {
  const [pending, start] = useTransition();
  const options: Array<{ value: "household" | "personal"; label: string }> = [
    { value: "household", label: householdName },
    { value: "personal", label: "Just me" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Finance space"
        className="inline-flex rounded-md border p-0.5"
        style={{ borderColor: "var(--border-soft)", opacity: pending ? 0.6 : 1 }}
      >
        {options.map((option) => {
          const active = option.value === scope;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => !active && start(() => switchFinanceScope(option.value))}
              className="rounded px-3 py-1 text-[0.8125rem] font-medium"
              style={{
                background: active ? "var(--bg-active)" : "transparent",
                color: active ? "var(--text)" : "var(--text-faint)",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {scope === "household"
          ? "Shared with everyone in the household."
          : "Only you can see this."}
      </p>
    </div>
  );
}
