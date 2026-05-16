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
    <div className="space-y-2">
      <select
        value={selected}
        disabled={pending}
        onChange={(event) => {
          const nextValue = event.target.value as FinanceCategory;
          setSelected(nextValue);
          setBulkMessage(null);
          startTransition(() => updateTransactionCategory(id, nextValue));
        }}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {FINANCE_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      {description ? (
        <div className="flex flex-wrap items-center gap-2">
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
                  count > 1 ? `Applied to ${count} similar transactions` : count === 1 ? "Only this match found" : "No similar matches found",
                );
              });
            }}
            className="text-[11px] font-medium text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Apply to similar
          </button>
          {bulkMessage ? <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{bulkMessage}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
