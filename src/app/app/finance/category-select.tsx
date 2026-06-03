"use client";

import { useState, useTransition } from "react";
import { FINANCE_CATEGORIES, type FinanceCategory } from "@/lib/finance-categories";
import {
  updateMatchingTransactionCategories,
  updateTransactionCategory,
} from "./actions";

export function CategorySelect({
  id,
  value,
  description,
  account,
}: {
  id: string;
  value: FinanceCategory;
  description?: string;
  account?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<FinanceCategory>(value);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <select
        value={selected}
        disabled={pending}
        onChange={(event) => {
          const nextValue = event.target.value as FinanceCategory;
          setSelected(nextValue);
          setBulkMessage(null);
          startTransition(() => updateTransactionCategory(id, nextValue));
        }}
        className="border-b border-rule bg-transparent px-1 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-soft focus:border-oxblood focus:outline-none"
      >
        {FINANCE_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      {description ? (
        <div className="flex flex-wrap items-baseline gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setBulkMessage(null);
              startTransition(async () => {
                const count = await updateMatchingTransactionCategories(
                  description,
                  account ?? null,
                  selected,
                );
                setBulkMessage(
                  count > 1
                    ? `applied to ${count} like entries`
                    : count === 1
                      ? "only this match"
                      : "no like entries",
                );
              });
            }}
            className="font-serif text-[0.7rem] italic text-ink-fade underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
          >
            apply to similar
          </button>
          {bulkMessage ? (
            <span className="font-serif text-[0.7rem] italic text-ink-fade">
              - {bulkMessage}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
